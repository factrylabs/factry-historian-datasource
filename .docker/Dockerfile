FROM grafana/grafana-oss:latest-ubuntu

USER root
WORKDIR /root

ENV PATH=/usr/local/go/bin:~/go/bin:$PATH
RUN ARCH=$(arch | sed s/aarch64/arm64/ | sed s/x86_64/amd64/) \
    && curl -o _go.tar.gz "https://dl.google.com/go/go1.20.linux-${ARCH}.tar.gz" \
    && tar -C /usr/local -xzf _go.tar.gz \
    && rm _go.tar.gz \
    && go install github.com/go-delve/delve/cmd/dlv@latest

COPY ./scripts/*.sh /

EXPOSE 3000
EXPOSE 2345

ENTRYPOINT [ "/wrapper.sh" ]
