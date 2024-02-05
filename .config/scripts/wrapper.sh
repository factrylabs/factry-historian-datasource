#!/bin/bash

set -e

start_delve(){
  while true;
  do
    PID=$(pgrep gpx_factry)
    if [[ -n "$PID" ]]
    then
      /root/go/bin/dlv attach --accept-multiclient --continue --api-version=2 --headless --listen=:2345 "$PID"
    else
      sleep 5
    fi
  done
}


if [[ -n "$DEBUG" ]]
then
  start_delve &
fi

/run.sh
