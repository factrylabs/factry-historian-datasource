//go:build pprof
// +build pprof

package main

func init() {
	go func (){
		server := &http.Server{
			Addr:         ":1234",
			ReadTimeout:  10 * time.Second,
			WriteTimeout: 10 * time.Second,
		}
		_ = server.ListenAndServe()
	} 
}
