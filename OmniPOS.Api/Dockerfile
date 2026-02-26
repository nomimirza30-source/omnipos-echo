# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj and restore
COPY ["OmniPOS.Api.csproj", "./"]
RUN dotnet restore "OmniPOS.Api.csproj"

# Copy everything else and build
COPY . .
RUN dotnet build "OmniPOS.Api.csproj" -c Release -o /app/build

# Publish Stage
FROM build AS publish
RUN dotnet publish "OmniPOS.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=publish /app/publish .

# Create uploads directory
RUN mkdir -p /app/wwwroot/uploads/logos

ENTRYPOINT ["dotnet", "OmniPOS.Api.dll"]
