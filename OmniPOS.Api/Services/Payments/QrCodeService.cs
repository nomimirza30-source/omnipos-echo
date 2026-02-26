using System.Security.Cryptography;
using System.Text;

namespace OmniPOS.Api.Services.Payments;

public class QrCodeService
{
    private readonly string _secretKey = "qr_signing_secret_omnipos_2026";

    public string GeneratePaymentLink(Guid orderId, decimal amount, Guid tenantId)
    {
        var payload = $"order={orderId}&amount={amount}&tenant={tenantId}";
        var signature = GenerateSignature(payload);
        
        // Final Scan-to-Pay URL
        return $"https://pay.omnipos.com/checkout?{payload}&sig={signature}";
    }

    private string GenerateSignature(string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToBase64String(hash);
    }
}
