using System;
using Microsoft.Data.Sqlite;

class CheckUsersProgram
{
    static void MainMethod()
    {
        var connectionString = "Data Source=omnipos.db";
        using var connection = new SqliteConnection(connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = "SELECT StaffId, TenantId, FullName, Role, Username FROM StaffMembers";

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            Console.WriteLine($"Username: {reader.GetString(4)}, Role: {reader.GetString(3)}, FullName: {reader.GetString(2)}, TenantId: {reader.GetString(1)}");
        }
    }
}
