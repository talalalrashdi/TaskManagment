FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcap2-bin \
    && setcap -r /opt/mssql/bin/sqlservr \
    && apt-get purge -y --auto-remove libcap2-bin \
    && rm -rf /var/lib/apt/lists/*

USER mssql

WORKDIR /var/opt/mssql

EXPOSE 1433

CMD ["/opt/mssql/bin/sqlservr"]
