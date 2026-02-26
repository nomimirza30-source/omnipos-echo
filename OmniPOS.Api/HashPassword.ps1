# Generate BCrypt hash for admin password
$code = @"
using OmniPOS.Api.Services;
using System;

public class HashGenerator {
    public static void Main() {
        var hash = PasswordHasher.HashPassword("admin123");
        Console.WriteLine(hash);
    }
}
"@

# Compile and run
Add-Type -TypeDefinition $code -ReferencedAssemblies @(
    "System.dll",
    ".\bin\Debug\net9.0\OmniPOS.Api.dll",
    ".\bin\Debug\net9.0\BCrypt.Net-Next.dll"
)

[HashGenerator]::Main()
