import * as signalR from "@microsoft/signalr";

const HUB_URL =
  process.env.NEXT_PUBLIC_SIGNALR_URL?.replace(/\/$/, "") ??
  "http://localhost:5270/hubs/projects";

export function createProjectHubConnection(token: string) {
  return new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token,
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .build();
}
