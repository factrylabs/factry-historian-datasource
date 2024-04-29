#!/bin/bash

start_delve(){
  while true;
  do
    PID=$(pgrep gpx_factry)
    echo "PID: $PID"
    if [[ -n "$PID" ]]
    then
      echo "Starting delve"
      /root/go/bin/dlv attach --accept-multiclient --continue --api-version=2 --headless --listen=:2345 "$PID"
    else
      echo "Waiting for gpx_factry to start"
      sleep 5
    fi
  done
}


if [[ -n "$DEBUG" ]]
then
  start_delve &
fi

/run.sh
