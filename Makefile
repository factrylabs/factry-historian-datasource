major = 2
minor = 2
patch = 1
prerelease =
project_name=factry-historian-datasource

COMMIT=$(shell git rev-parse --short HEAD)
PROTO_DIR= pkg/proto
PROTO_FILES = $(PROTO_DIR)/*.proto

.DEFAULT_GOAL := help
.PHONY: outdated help version all ver set_frontend_version version_major_bump version_minor_bump version_patch_bump version_bump_major version_bump_minor version_bump_patch tag_version build_all build_web build_web_dev gen_proto package run_server run_debug clean validate

all: migrate_all
version_bump_major: version_major_bump set_frontend_version tag_version  ## Bumps the current major version
version_bump_minor: version_minor_bump set_frontend_version tag_version ## Bumps the current minor version
version_bump_patch: version_patch_bump set_frontend_version tag_version ## Bumps the current patch version

outdated: ## Checks the dependecies of this project to see if they're all up to date
	export GO111MODULE=off; go install github.com/psampaz/go-mod-outdated
	@go list -u -m -json all | $(GOPATH)/bin/go-mod-outdated -direct

help: ## These help instructions
	@grep -E '^[a-z0-9A-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

version: ## Prints the current version
ifdef prerelease
	@echo v$(major).$(minor).$(patch)$(prerelease)+$(COMMIT)
else
	@echo v$(major).$(minor).$(patch)
endif

ver: ## Prints the current version without the 'v' prefix
ifdef prerelease
	@echo $(major).$(minor).$(patch)$(prerelease)+$(COMMIT)
else
	@echo $(major).$(minor).$(patch)
endif

set_frontend_version: ## Sets the version in the frontend
	@pnpm version --no-git-tag-version --allow-same-version $(shell make version)

version_major_bump:
	@sed 's/^patch = $(patch)$$/patch = 0/' Makefile > tmp && mv tmp Makefile
	@sed 's/^minor = $(minor)$$/minor = 0/' Makefile > tmp && mv tmp Makefile
	@sed 's/^major = $(major)$$/major = $(shell expr $(major) + 1)/' Makefile > tmp && mv tmp Makefile

version_minor_bump:
	@sed 's/^patch = $(patch)$$/patch = 0/' Makefile > tmp && mv tmp Makefile
	@sed 's/^minor = $(minor)$$/minor = $(shell expr $(minor) + 1)/' Makefile > tmp && mv tmp Makefile

version_patch_bump:
	@sed 's/^patch = $(patch)$$/patch = $(shell expr $(patch) + 1)/' Makefile > tmp && mv tmp Makefile

tag_version:
ifdef message
	@git add Makefile package.json pnpm-lock.yaml
	@git commit -m "$(message)"
	@git tag -a $(shell make version) -m "$(message)"
else
	@git add Makefile package.json pnpm-lock.yaml
	@git commit -m "Updated to $(shell make version)"
	@git tag -a $(shell make version) -m "Updated to $(shell make version)"
endif

build_all: build_web ## Build current project for all targets
	mage buildAll

build_web: ## Build the web application
	pnpm config set store-dir .pnpm-store
	pnpm install && pnpm run build

build_web_dev: ## Build the web application in development mode
	pnpm config set store-dir .pnpm-store
	pnpm install && pnpm run build:dev

gen_proto: ## Generates the go files from the .proto files
	protoc --go_out=. --go_opt=paths=source_relative \--go-grpc_out=. --go-grpc_opt=paths=source_relative \$(PROTO_FILES)

dist: build_all

factry-historian-datasource: dist
	mkdir -p factry-historian-datasource
	cp -r dist/* factry-historian-datasource

factry-historian-datasource.zip: factry-historian-datasource
	zip -qr factry-historian-datasource.zip factry-historian-datasource

package: factry-historian-datasource
	zip factry-historian-datasource-$(shell make version).zip factry-historian-datasource -r
	export GRAFANA_API_KEY=$(key); npx @grafana/sign-plugin@latest --rootUrls $(rootUrls)

run_server: # Runs the grafana datasource
	DEVELOPMENT=false docker compose up --build --force-recreate

run_debug: build_web_dev # Runs the grafana datasource in debug mode
	docker compose up --build --force-recreate

clean: # Cleans build artifacts
	mage clean
	docker compose down --rmi all -v
	rm -rf factry-historian-datasource
	rm factry-historian-datasource*.zip

validate: factry-historian-datasource.zip ## Validates the code
	npx @grafana/plugin-validator@latest -sourceCodeUri file://. factry-historian-datasource.zip
