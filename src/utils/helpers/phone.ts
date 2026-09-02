export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const noLeadingZeros = digits.replace(/^0+/, '');
    // Take up to the last 10 digits as the canonical identifier
    return noLeadingZeros.length > 10 ? noLeadingZeros.slice(-10) : noLeadingZeros;
}
