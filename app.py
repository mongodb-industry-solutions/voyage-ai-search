#
# Copyright (c) 2025, 2026 MongoDB Inc.
# Author: Benjamin Lorenz <benjamin.lorenz@mongodb.com>
#

from flask import Flask, Response, session, request, jsonify, render_template
from voyageai import Client as VoyageClient
import os, time, json, textwrap, pymongo, secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(24)
print("App secret key (tmp): " + app.secret_key)

voyage_client = VoyageClient()

current_coll = 'charts'  # default
last_result = []
all_results = []  # Store all search results

# Ensure API key exists in environment variables
if not os.environ.get("VOYAGE_API_KEY"):
    print("Environment variable VOYAGE_API_KEY is missing. Aborting...")
    exit(1)

# MongoDB connection
_MC = os.getenv('MONGODB_IST_MEDIA')
coll_print = pymongo.MongoClient(_MC)['1_media_demo']['print']
coll_charts = pymongo.MongoClient(_MC)['1_media_demo']['charts']
coll_podcast = pymongo.MongoClient(_MC)['ft']['audio']


@app.route('/')
def home():
    return render_template('index.html')


@app.route("/sidebar_text")
def sidebar_text():
    return Response(last_answer[0], mimetype='text/plain')


@app.route("/sidebar")
def sidebar_image():
    data_type = session.get('data_type', 'charts')
    offset = 0
    text = ""
    if data_type == 'charts':
        base_path = "https://ist.media/content/ft/charts"
        filename = last_result[0].replace(' ', '_') + '.png'
        header = textwrap.shorten(last_result[0], width=58)
        media_type = 'image'
    elif data_type == 'print':
        base_path = "https://ist.media/content/ft/print"
        filename = last_result[0].replace('PrintMedia/', '')
        header = filename
        media_type = 'image'
    else: # podcast
        offset = last_result[0]
        text = last_result[1]
        base_path = "https://ist.media/content/ft/podcast"
        filename = "tesla.mp3"
        header = 'FT Podcast about Tesla and Elon Musk'
        media_type = 'audio'
    url = f"{base_path}/{filename}"
    return jsonify({ 'url': url, 'header': header, 'media_type': media_type,
                     'offset': offset, 'text': text })


@app.route("/load_result", methods=['POST'])
def load_result():
    """Load a specific result by index"""
    result_index = request.json.get('index', 0)
    data_type = session.get('data_type', 'charts')

    if result_index < len(all_results):
        result = all_results[result_index]
        last_result.clear()

        if data_type == 'podcast':
            last_result.append(result.get('offset', 0))
            last_result.append(result.get('text', ''))
        elif data_type == 'charts':
            last_result.append(result.get('description', ''))
        elif data_type == 'print':
            last_result.append(result.get('image_filename', ''))

        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Invalid index'})


@app.route('/chat', methods=['POST'])
def chat():
    query = request.json.get('message')
    data_type = request.json.get('data_type', session.get('data_type', 'charts'))

    try:
        response = voyage_client.multimodal_embed(
            inputs=[[query]],
            model="voyage-multimodal-3",
            input_type="query"
        )
        query_vector = response.embeddings[0]
    except Exception as e:
        print(f"Error embedding query: {e}")

    pipelines = {
        'charts': {
            'coll': coll_charts,
            'pipeline': [
                {"$vectorSearch": {
                    "index": "charts_vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 10,
                    "limit": 3
                }},
                {"$project": {
                    "description": 1,
                    "score": {"$meta": "vectorSearchScore"},
                    "_id": 0
                }}
            ],
            'filename': 'description'
        },
        'print': {
            'coll': coll_print,
            'pipeline': [
                {"$vectorSearch": {
                    "index": "print_vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 10,
                    "limit": 3
                }},
                {"$project": {
                    "image_filename": 1,
                    "score": {"$meta": "vectorSearchScore"},
                    "issue_date": 1,
                    "page": 1,
                    "_id": 0
                }}
            ],
            'filename': 'image_filename'
        },
        'podcast': {
            'coll': coll_podcast,
            'pipeline': [
                {
                    '$vectorSearch': {
                        'index': 'vector_index',
                        'path': 'text',
                        'query': query,
                        'numCandidates': 10,
                        'limit': 2
                    }
                },
                {
                    '$project': {
                        'text': 1,
                        'offset': 1,
                        'score': {'$meta': 'vectorSearchScore'},
                        '_id': 0
                    }
                }
            ]
        }
    }

    config = pipelines.get(data_type, pipelines['charts'])
    collection = config['coll']
    pipeline = config['pipeline']

    answer = ""

    try:
        results = list(collection.aggregate(pipeline))
        if results:
            all_results.clear()
            all_results.extend(results)
            last_result.clear()
            if data_type == 'podcast':
                last_result.append(results[0]['offset'])
                last_result.append(results[0]['text'])
            else:
                last_result.append(results[0][config['filename']])

            for idx, result in enumerate(results):
                if data_type == 'charts':
                    answer += (
                        f" - <a href='#' class='result-link' data-index='{idx}'>"
                        f"{textwrap.shorten(result['description'], width=58)}</a>"
                        f", **Score**: {result['score']:.4f}\n\n"
                    )
                elif data_type == 'print':
                    answer += (
                        f" - <a href='#' class='result-link' data-index='{idx}'>"
                        f"**Issue**: {result['issue_date']}, **Page**: {result['page']}</a>"
                        f", **Score**: {result['score']:.4f}\n\n"
                    )
                elif data_type == 'podcast':
                    answer += (
                        f" - <a href='#' class='result-link' data-index='{idx}'>"
                        f"**Offset**: {result['offset']}</a>"
                        f", **Score**: {result['score']:.4f}\n\n"
                    )
                else:
                    answer == ""
        else:
            answer = "No matches found."
    except Exception as e:
        print(
            f"Vector search error: {e}."
            f" Ensure Atlas Vector Search is enabled and index is ready."
        )

    def generate():
        yield f"data: { json.dumps({ 'content': answer }) }\n\n"
        yield f"data: { json.dumps({ 'done': True }) }\n\n"

    session['data_type'] = data_type
    session.modified = True

    return Response(generate(), mimetype='text/event-stream')


if __name__ == '__main__':
    app.run(debug=False, use_reloader=False, host="127.0.0.1", port=9494)
