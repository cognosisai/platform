import flask
import logging
import json
from flask import request
import tensorflow_hub as hub


log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app = flask.Flask('encoder')


@app.route('/', methods=['post'])
def home():
    payload = request.json  # payload should be like ["asdfasdf","asdfasdf"]
    print(payload)
    embeddings = embed(payload)
    result = [{'vector': i.numpy().tolist(), 'string': j}
              for i, j in zip(embeddings, payload)]
    return flask.Response(json.dumps(result), mimetype='application/json')


if __name__ == '__main__':
    #embed = hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
    # USEv5 is about 100x faster than 4
    embed = hub.load(
        "https://tfhub.dev/google/universal-sentence-encoder-large/5")
    app.run(host='0.0.0.0', port=8080)
