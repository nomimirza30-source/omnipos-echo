import { jsPDF } from 'jspdf';

export const generateReceipt = (order, branding = {}, tables = []) => {
    const doc = jsPDF({
        unit: 'mm',
        format: [80, 150] // Common thermal receipt size
    });

    const primaryColor = branding.primaryColor || '#000000';
    const appName = branding.appName || 'OmniPOS';

    // Header
    doc.setFontSize(18);
    doc.setTextColor(primaryColor);
    doc.text(appName, 40, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor('#666666');
    doc.text('RESTAURANT RECEIPT', 40, 22, { align: 'center' });

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(5, 25, 75, 25);

    // Resolve Table Number
    let tableDisplay = 'Walk-in';
    if (order.tableNum) {
        tableDisplay = order.tableNum;
    } else if (order.tableId) {
        const tableIds = order.tableId.split(',').filter(Boolean);
        const tableNums = tableIds.map(tid => tables.find(t => t.id === tid)?.num).filter(Boolean);
        if (tableNums.length > 0) {
            tableDisplay = tableNums.join(', ');
        }
    }

    // Order Info
    doc.setFontSize(8);
    doc.setTextColor('#000000');
    doc.text(`Order ID: ${order.id.substring(0, 8)}`, 5, 32);
    doc.text(`Date: ${new Date().toLocaleString()}`, 5, 37);
    doc.text(`Table: ${tableDisplay}`, 5, 42);
    doc.text(`Guests: ${order.guestCount || 1}`, 5, 47);

    // Add Operator Name
    if (order.operatorName) {
        doc.text(`Served by: ${order.operatorName}`, 5, 52);
    }

    // Divider
    doc.line(5, 50, 75, 50);

    // Items Header
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 5, 55);
    doc.text('Qty', 55, 55);
    doc.text('Price', 65, 55);
    doc.setFont('helvetica', 'normal');

    let y = 62;
    order.items.forEach(item => {
        // Handle long names
        const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
        doc.text(name, 5, y);
        doc.text(item.qty.toString(), 57, y);
        doc.text(`£${(item.price * item.qty).toFixed(2)}`, 65, y);
        y += 6;
    });

    // Divider
    doc.line(5, y, 75, y);
    y += 6;

    // Subtotal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 5, y);
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    doc.text(`£${subtotal.toFixed(2)}`, 75, y, { align: 'right' });
    y += 5;

    // Service Charge
    if (order.serviceCharge > 0) {
        doc.text('Service Charge:', 5, y);
        doc.text(`£${parseFloat(order.serviceCharge).toFixed(2)}`, 75, y, { align: 'right' });
        y += 5;
    }

    // Discount
    if (order.discount > 0) {
        doc.setTextColor('#ff4444');
        doc.text('Discount:', 5, y);
        doc.text(`-£${parseFloat(order.discount).toFixed(2)}`, 75, y, { align: 'right' });
        doc.setTextColor('#000000');
        y += 5;
    }

    y += 2;
    doc.line(5, y, 75, y);
    y += 6;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, y);
    const displayTotal = order.finalTotal !== undefined ? parseFloat(order.finalTotal).toFixed(2) : order.amount;
    doc.text(`£${displayTotal}`, 75, y, { align: 'right' });

    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you for dining with us!', 40, y, { align: 'center' });

    // Save PDF
    doc.save(`Receipt_${order.id.substring(0, 8)}.pdf`);
};
