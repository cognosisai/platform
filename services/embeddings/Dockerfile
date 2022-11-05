FROM armswdev/tensorflow-arm-neoverse AS build
EXPOSE 8080

WORKDIR /srv
COPY ./* /srv/
RUN pip install flask tensorflow_hub
RUN python download-init-embeddings.py

# Package
# FROM tensorflow/tensorflow
# RUN apt install nodejs npm 
WORKDIR /srv
CMD python embeddings-service.py
