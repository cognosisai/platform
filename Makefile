build-apple:
	@make build-embeddings-apple

build-x86:
	@make build-embeddings-x86

build-embeddings-apple:
	@docker build -f ./services/embeddings/Dockerfile.apple -t cognosis-embeddings ./services/embeddings

build-embeddings-x86:
	@docker build  -f ./services/embeddings/Dockerfile.x86 -t cognosis-embeddings ./services/embeddings

run:
	@docker-compose up