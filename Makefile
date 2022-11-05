build:
	@make build-embeddings

build-embeddings:
	@docker build -t cognosis-embeddings ./services/embeddings

run:
	@docker-compose up