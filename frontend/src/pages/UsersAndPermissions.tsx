// Update the fetchUsers function to add error handling for Promise.all
async function fetchUsers() {
    try {
        const [userData, permissionData] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/permissions'),
        ]);

        // Check for errors in response
        if (!userData.ok) {
            throw new Error('Failed to fetch users');
        }
        if (!permissionData.ok) {
            throw new Error('Failed to fetch permissions');
        }

        const users = await userData.json();
        const permissions = await permissionData.json();
        // Continue processing users and permissions
    } catch (error) {
        console.error('Error fetching users and permissions:', error);
        // Handle error accordingly
    }
}