using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TechFlowPM.API.Helpers;

namespace TechFlowPM.API.Hubs;

[Authorize]
public sealed class ProjectHub : Hub
{
    public async Task JoinProject(int projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroups.Project(projectId));
    }

    public async Task LeaveProject(int projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroups.Project(projectId));
    }
}
