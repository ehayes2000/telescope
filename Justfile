IMAGE_NAME := "telescope"

build:
    docker build -t {{IMAGE_NAME}} .
serve:
    docker run -p 8080:5050 --env-file .env {{IMAGE_NAME}}
