FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["TechFlowPM.API/TechFlowPM.API.csproj", "TechFlowPM.API/"]
RUN dotnet restore "TechFlowPM.API/TechFlowPM.API.csproj"

COPY . .
WORKDIR /src/TechFlowPM.API
RUN dotnet publish "TechFlowPM.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "TechFlowPM.API.dll"]
