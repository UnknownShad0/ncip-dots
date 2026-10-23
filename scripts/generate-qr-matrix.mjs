import qrCode from 'qrcode-generator';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const payload = JSON.parse(input);
if (typeof payload.value !== 'string' || payload.value.length === 0) {
    throw new Error('A non-empty QR value is required.');
}

const qr = qrCode(0, 'M');
qr.addData(payload.value, 'Byte');
qr.make();

const size = qr.getModuleCount();
const rows = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => qr.isDark(row, column) ? '1' : '0').join(''),
);

process.stdout.write(JSON.stringify({ size, rows }));
