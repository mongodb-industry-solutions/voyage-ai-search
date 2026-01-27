//
// Copyright (c) 2025, 2026 MongoDB Inc.
// Author: Benjamin Lorenz <benjamin.lorenz@mongodb.com>
//

function oldUpdateSidebar() {
    fetch('/sidebar')
        .then(res => res.json())
        .then(data => {
            document.getElementById('sidebar').innerHTML = `
                <h2 style="font-size: 1.4rem; color: #444;">${data.header}</h2>
                <img src="${data.url}"
                     alt="Chart"
                     style="max-width: 100%;
                            height: auto;
                            border-radius: 8px;
                            margin-top: 15px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            `;
        })
        .catch(err => {
            console.error('Image load failed:', err);
            document.getElementById('sidebar').innerHTML = '<p>No image available</p>';
        });
}

function updateSidebar() {
    fetch('/sidebar')
        .then(res => res.json())
        .then(data => {
            const formatted = data.text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br>')
                  .replace(/  /g, '&nbsp;&nbsp;');
            const sidebar = document.getElementById('sidebar');
            if (data.media_type === 'image') {
                sidebar.innerHTML = `
                <h2 style="font-size: 1.4rem; color: #444;">${data.header}</h2>
                <img src="${data.url}"
                     alt="Chart"
                     style="max-width: 100%;
                            height: auto;
                            border-radius: 8px;
                            margin-top: 15px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                `;
            } else {
                sidebar.innerHTML = `
                    <h2 style="font-size: 1.4rem; color: #444; margin-bottom: 1.5em;">${data.header}</h2>
                    <div style="line-height: 1.3;margin-bottom: 1em">${data.offset} seconds into the podcast</div>
                    <div style="font-size: 1.2rem; line-height: 1.3;">${formatted}</div>
                    <audio controls id="podcast-player"
                           src="${data.url}"
                           style="width: 100%; margin-top: 15px;">
                        Your browser does not support audio.
                    </audio>
                `;
                const audio = document.getElementById('podcast-player');
                audio.addEventListener('loadedmetadata', () => {
                    audio.currentTime = data.offset;  // ← Springt zum Offset!
                    audio.play().catch(e => console.log('Autoplay blocked:', e));
                });
            }
        });
}

function updateTextSidebar() {
    fetch('/sidebar_text')
        .then(res => res.text())
        .then(text => {
            const formatted = text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br>')
                  .replace(/  /g, '&nbsp;&nbsp;');

            document.getElementById('sidebar').innerHTML = `
              <h2 style="font-size: 1.25rem; color: #444;">Image</h2>
              <div style="font-family: monospace; font-size: 0.6rem; line-height: 1.3;">${formatted}</div>
            `;
        });
}

function handleChatFormSubmit(e, customMessage = null) {
    if (e) e.preventDefault();
    let message = customMessage || $('#message-input').val();
    $('#message-input').val('');

    // Display user's message
    $('#chat-box').append(`
            <div class="message user">
                <div class="content">${message}</div>
            </div>
        `);
    $('#chat-box').scrollTop($('#chat-box')[0].scrollHeight);

    // Create a placeholder for the assistant's message
    let assistantMessageDiv = $(`
            <div class="message assistant">
                <div class="content"></div>
            </div>
        `);
    $('#chat-box').append(assistantMessageDiv);
    $('#chat-box').scrollTop($('#chat-box')[0].scrollHeight);

    let assistantMessageContent = assistantMessageDiv.find('.content');

    // Use Fetch API to send POST request and handle streaming response
    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            data_type: sessionStorage.getItem('data_type') || 'charts'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    return;
                }
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n\n');
                buffer = lines.pop(); // Save incomplete line

                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        let data = JSON.parse(line.slice(6));
                        if (data.error) {
                            alert(data.error);
                            return;
                        }
                        if (data.content) {
                            assistantMessageContent.append(data.content);
                            $('#chat-box').scrollTop($('#chat-box')[0].scrollHeight);
                        }
                        if (data.done) {
				            parsed = marked.parse(assistantMessageContent[0].innerHTML);
                            assistantMessageContent[0].innerHTML = parsed;
                            $('#chat-box').scrollTop($('#chat-box')[0].scrollHeight);
                            updateSidebar();
                        }
                    }
                }
                read();

            }).catch(error => {
                console.error('Error reading stream:', error);
            });
        }
        read();
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('An error occurred while communicating with the server.');
        });
};

$(document).on('click', '.result-link', function(e) {
    e.preventDefault();
    e.stopPropagation();

    const index = $(this).data('index');

    // Send request to load this specific result
    fetch('/load_result', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ index: index })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateSidebar();
        } else {
            console.error('Failed to load result:', data.error);
        }
    })
    .catch(error => {
        console.error('Error loading result:', error);
    });
});

$(document).ready(function() {
    $('#chat-form').on('submit', handleChatFormSubmit);

    $('.chat-shortcut').on('click', function(e) {
        let message = $(this).data('message');
        handleChatFormSubmit(e, message);
    });

});

$(document).on('click', '.btn[data-type]', function() {
    $('.btn[data-type]').removeClass('active');
    $(this).addClass('active');
    // Hier Backend anpassen: data-type in Request
    console.log('Selected:', $(this).data('type'));
});

// Tabbed example queries - preserves exact HTML layout
$(document).on('click', '.chat-shortcut', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const message = $(this).data('message');
    handleChatFormSubmit(null, message);
});

$(document).on('click', '.btn[data-type]', function() {
    const oldType = sessionStorage.getItem('data_type');
    const type = $(this).data('type');
    $('.btn[data-type]').removeClass('active');
    $(this).addClass('active');
    sessionStorage.setItem('data_type', type);

    if (type !== oldType) {
        //$('#chat-box').fadeOut(200, function() {
        //    $(this).empty().fadeIn(200);
        //});
        $('#chat-box').empty()
        $('#sidebar').empty()
        $('#message-input').val('');
        //$('#message-input').focus();
    }

    const examples = {
        'charts': [
            { display: 'MSCI World vs. MSCI Asia Pacific', message: 'MSCI World vs. MSCI Asia Pacific' },
            { display: 'renminbi vs. USD', message: 'renminbi vs. USD' },
            { display: 'Galata Tower', message: 'Galata Tower' },
            { display: 'Brücke des 25. April (different language - still works!)',
              message: 'Brücke des 25. April' }
        ],
        'print': [
            { display: 'milk production price war', message: 'milk production price war' },
            { display: 'moon landing russia vs us', message: 'moon landing russia vs us' },
        ],
        'podcast': [
            { display: 'Trump beautiful bill how does it affect Tesla',
              message: 'Trump beautiful bill how does it affect Tesla' },
            { display: 'future of taxi', message: 'future of taxi' },
        ]
    };

    let html = `
        <div class="mt-3">
            <strong style="color: #444">You can try these queries:</strong>
            <ul>`;

    examples[type].forEach(item => {
        html += `
            <li class="mb-0">
                <a href="#" class="chat-shortcut" style="color: #6f9f6f"
                   data-message="${item.message}">
                    ${item.display}
                </a>
            </li>`;
    });

    html += `</ul></div>`;
    $('#examples-container').html(html);
});

$(document).ready(function() {
    $('.btn[data-type="charts"]').click();
});
