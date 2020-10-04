FROM node:12

RUN apt-get update && apt-get install -y rsync

RUN mkdir -p /usr/app
RUN mkdir -p /usr/workspace

COPY *.sh /usr/app/

CMD /bin/bash -c "/usr/app/run.sh"