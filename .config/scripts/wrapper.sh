#!/bin/bash

start_delve(){
  while true;
  do
    PID=`pgrep gpx_factry`
    if [[ ! -z "$PID" ]]
    then
      /root/go/bin/dlv attach --accept-multiclient --continue --api-version=2 --headless --listen=:2345 $PID
    else
      sleep 1
    fi
  done
}

start_delve &

/run.sh
