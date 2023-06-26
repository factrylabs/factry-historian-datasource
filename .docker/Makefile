ifndef TAG
DOCKER_TAG=$(shell git branch --show-current | tr / _ )
else
DOCKER_TAG=$(subst /,_,${TAG})
endif

ARCH=$(shell arch | sed s/aarch64/arm64/ | sed s/x86_64/amd64/)

.PHONY: help build push run_debug build_debug build_frontend_debug

help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

build_debug: ## builds the debug version for the current platform
	@GOOS=linux go build -o ../dist/gpx_factry-historian-datasource_linux_$(ARCH) -gcflags="all=-N -l" ../pkg
	@pnpm config set store-dir ../.pnpm-store
	@pnpm install --dir ../

build: ## Build docker container
	@DOCKER_BUILDKIT=1 docker build ./  -t registry.gitlab.com/factry/historian/grafana-datasource:$(DOCKER_TAG)

run_debug: build build_debug ## run plugin as debug
	@docker run --rm --detach --name grafana-datasource-${DOCKER_TAG} -p 2345:2345 -p 3000:3000 -e GF_DEFAULT_APP_MODE=development -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=factry-historian-datasource -e GF_PLUGINS_ENABLE_ALPHA=true -v $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../dist):/var/lib/grafana/plugins/factry-historian-datasource --cap-add=SYS_PTRACE --security-opt="apparmor=unconfined" registry.gitlab.com/factry/historian/grafana-datasource:$(DOCKER_TAG)
	@pnpm run --dir ../ watch

push: build ## Push image and tags to remote repository
	@echo 'Pushing $(DOCKER_TAG) to repo'
	docker push registry.gitlab.com/factry/historian/grafana-datasource:$(DOCKER_TAG)
	for tag in ${TAGS}; do\
		docker push registry.gitlab.com/factry/historian/grafana-datasource:$$tag ;\
	done
