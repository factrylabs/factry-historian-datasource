major = 1
minor = 0
patch = 0
project_name=grafana-datasource

PROTO_DIR= pkg/proto
PROTO_FILES = $(PROTO_DIR)/*.proto

.DEFAULT_GOAL := help
.PHONY: outdated help version version_major_bump version_minor_bump version_patch_bump

all: migrate_all
version_bump_major: version_major_bump tag_version ## Bumps the current major version
version_bump_minor: version_minor_bump tag_version ## Bumps the current minor version
version_bump_patch: version_patch_bump tag_version ## Bumps the current patch version
version_bump_prerelease: version_prerelease_bump tag_version ## Bumps the current prerelease version

outdated: ## Checks the dependecies of this project to see if they're all up to date
	export GO111MODULE=off; go install github.com/psampaz/go-mod-outdated
	@go list -u -m -json all | $(GOPATH)/bin/go-mod-outdated -direct

help: ## These help instructions
	@grep -E '^[a-z0-9A-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

version: ## Prints the current version
	@echo v$(major).$(minor).$(patch)$(prerelease)$(prerelease-identifier)

ver: ## Prints the current version without the 'v' prefix
	@echo $(major).$(minor).$(patch)$(prerelease)$(prerelease-identifier)

version_major_bump:
	@sed -i  's/^major = $(major)$$/major = $(shell expr $(major) + 1)/' Makefile
	@cd pnpm version $(shell expr $(major) + 1).$(minor).$(patch)$(prerelease)$(prerelease-identifier)

version_minor_bump:
	@sed -i  's/^minor = $(minor)$$/minor = $(shell expr $(minor) + 1)/' Makefile
	@cd pnpm version $(major).$(shell expr $(minor) + 1).$(patch)$(prerelease)$(prerelease-identifier)

version_patch_bump:
	@sed -i  's/^patch = $(patch)$$/patch = $(shell expr $(patch) + 1)/' Makefile
	@cd pnpm version $(major).$(minor).$(shell expr $(patch) + 1)$(prerelease)$(prerelease-identifier)

version_prerelease_bump:
	@sed -i  's/^prerelease-identifier = $(prerelease-identifier)$$/prerelease-identifier = $(shell expr $(prerelease-identifier) + 1)/' Makefile
	@cd pnpm version -f $(major).$(minor).$(patch)$(prerelease)$(shell expr $(prerelease-identifier) + 1)

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

build_all: build_linux64 build_macos ## Build current project for all targets
	mage -v

build_web: ## Build the web application
	pnpm config set store-dir .pnpm-store
	pnpm install && pnpm run build

gen_proto: ## Generates the go files from the .proto files
	protoc --go_out=. --go_opt=paths=source_relative \--go-grpc_out=. --go-grpc_opt=paths=source_relative \$(PROTO_FILES)
