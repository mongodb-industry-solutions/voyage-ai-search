# Demo of multimodal semantic search with Voyage AI

This is derived from multiple Proof of Concepts that I conducted
for the Financial Times during fall 2025.


## Installation


#### Install Python 3.12
```
brew install python@3.12
```


#### Set the path in your .zshrc

```
export PATH="$(brew --prefix)/opt/python@3.12/libexec/bin:$PATH"
```


#### Create and activate a Python virtual environment

```
python -m venv <dir>
source <dir>/bin/activate
```


#### Install Python packages

```
pip install -r voyage-ai-search/requirements.txt
```


#### Start the application:

```
cd voyage-ai-search
python app.py
```

If all goes well, you can access the app from your browser at localhost:9494.


## Acknowledgements

I want to thank the datascience team at FT for providing me with the content
and opportunity to show the value of Voyage AI multimodal. Also, thank you,
Andrew Fenby, for your great support and trust.

[Benjamin Lorenz](https://www.linkedin.com/in/benjaminlorenz/)
