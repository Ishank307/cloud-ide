FROM node:18-alpine

# Install Java (OpenJDK 21), Python3, C/C++ compiler (gcc/g++), and bash for execution
RUN apk add --no-cache openjdk21-jdk openjdk21 python3 gcc g++ bash
