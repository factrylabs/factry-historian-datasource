FROM grafana/grafana-oss:latest-ubuntu

USER root
WORKDIR /root

RUN apt-get -y update
RUN apt-get -y install git build-essential

RUN curl -o _go.tar.gz https://dl.google.com/go/go1.20.linux-amd64.tar.gz
RUN tar -C /usr/local -xzf _go.tar.gz
RUN rm _go.tar.gz

RUN echo "export PATH=$PATH:/usr/local/go/bin:~/go/bin" >> ~/.bashrc

RUN /usr/local/go/bin/go install github.com/go-delve/delve/cmd/dlv@latest

COPY ./scripts/*.sh /

EXPOSE 3000
EXPOSE 2345

ENTRYPOINT [ "/wrapper.sh" ]
