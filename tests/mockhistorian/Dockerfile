# Builds the e2e mock Historian API as a static binary so the container starts
# instantly (no compile at boot, avoiding a race with the datasource health
# check). Build context is the repo root: docker build -f tests/mockhistorian/Dockerfile .
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /mockhistorian ./tests/mockhistorian

FROM gcr.io/distroless/static-debian12
COPY --from=build /mockhistorian /mockhistorian
EXPOSE 8000
ENTRYPOINT ["/mockhistorian"]
