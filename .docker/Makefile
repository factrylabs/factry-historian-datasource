ifndef TAG
DOCKER_TAG=$(shell git branch --show-current | tr / _ )
else
DOCKER_TAG=$(subst /,_,${TAG})
endif

.PHONY: help

help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

build: ## Build docker container
	@DOCKER_BUILDKIT=1 docker build ./  -t registry.gitlab.com/factry/historian/grafana-datasource:$(DOCKER_TAG)

push: ## Push image and tags to remote repository
	@echo 'Pushing $(DOCKER_TAG) to repo'
	docker push registry.gitlab.com/factry/historian/grafana-datasource:$(DOCKER_TAG)
	for tag in ${TAGS}; do\
		docker push registry.gitlab.com/factry/historian/grafana-datasource:$$tag ;\
	done
