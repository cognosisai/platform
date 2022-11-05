import logging
import json
from flask import request
import tensorflow_hub as hub

# USEv5 is about 100x faster than 4
embed = hub.load("https://tfhub.dev/google/universal-sentence-encoder-large/5")
