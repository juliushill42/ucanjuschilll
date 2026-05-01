FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY go.mod ./
RUN go mod tidy
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./main.go

FROM alpine:3.19
RUN apk add --no-cache ca-certificates wget ffmpeg
WORKDIR /app
COPY --from=builder /app/server .
RUN mkdir -p /data/uploads
EXPOSE 8000
CMD ["/app/server"]
