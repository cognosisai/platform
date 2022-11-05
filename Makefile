build:
	@make build-embeddings

build-embeddings:
	@docker build -t cognosis-embeddings ./services/embedding

run:
	@docker-compose up