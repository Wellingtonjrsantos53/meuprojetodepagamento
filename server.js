const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');

const app = express();
const port = 3001;

// Configuração do MercadoPago
const client = new MercadoPagoConfig({ 
    accessToken: 'TEST-8155657262249649-091319-a2647f3eeb5a3e68df32ae7aeac4ce0e-290268833',
    options: {
        integratorId: 'dev_aa2d89add88111ebb2fb0242ac130004'
    }
});
const payment = new Payment(client);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para criar pagamento PIX
app.post('/create_pix_payment', async (req, res) => {
    try {
        const { amount, description, email, firstName, lastName, identification } = req.body;

        const paymentData = {
            transaction_amount: parseFloat(amount),
            description: description || 'Pagamento via PIX',
            payment_method_id: 'pix',
            payer: {
                email: email,
                first_name: firstName,
                last_name: lastName,
                identification: identification ? {
                    type: identification.type || 'CPF',
                    number: identification.number
                } : undefined
            }
        };

        const requestOptions = {
            idempotencyKey: crypto.randomUUID(),
        };

        const result = await payment.create({ body: paymentData, requestOptions });

        // Retorna os dados necessários para o frontend
        res.json({
            success: true,
            payment_id: result.id,
            status: result.status,
            qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            qr_code: result.point_of_interaction?.transaction_data?.qr_code,
            ticket_url: result.point_of_interaction?.transaction_data?.ticket_url
        });

    } catch (error) {
        console.error('Erro ao criar pagamento PIX:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para criar pagamento com cartão
app.post('/create_card_payment', async (req, res) => {
    try {
        const { 
            amount, 
            description, 
            email, 
            firstName, 
            lastName, 
            identification,
            cardToken,
            installments,
            payment_method_id,
            issuer_id,
            sessionId,
            address,
            phone,
            webhook_url,
            external_reference
        } = req.body;

        // Extrai código de área e número do telefone
        const phoneClean = phone ? phone.replace(/\D/g, '') : '';
        const areaCode = phoneClean.length >= 10 ? parseInt(phoneClean.substring(0, 2)) : 11;
        const phoneNumber = phoneClean.length >= 10 ? phoneClean.substring(2) : phoneClean;

        const paymentData = {
            transaction_amount: parseFloat(amount),
            token: cardToken, // Token do cartão gerado no frontend
            description: description || 'Recarga de Saldo',
            installments: parseInt(installments) || 1,
            payment_method_id: payment_method_id,
            issuer_id: issuer_id || null,
            payer: {
                email: email,
                first_name: firstName ? firstName.trim() : '',
                last_name: lastName ? lastName.trim() : '',
                identification: {
                    type: 'CPF',
                    number: identification ? identification.replace(/\D/g, '') : ''
                },
                address: {
                    zip_code: address?.zip_code ? address.zip_code.replace(/\D/g, '') : '',
                    street_name: address?.street_name || '',
                    street_number: address?.street_number ? String(address.street_number) : '',
                    neighborhood: address?.neighborhood || '',
                    city: address?.city || '',
                    federal_unit: address?.state || ''
                }
            },
            additional_info: {
                shipments: {
                    receiver_address: {
                        zip_code: address?.zip_code ? address.zip_code.replace(/\D/g, '') : '',
                        street_name: address?.street_name || '',
                        city_name: address?.city || '',
                        state_name: address?.state || '',
                        street_number: address?.street_number ? String(address.street_number) : ''
                    }
                },
                items: [
                    {
                        id: `SALDO_${Date.now()}`,
                        title: 'Recarga de Saldo',
                        description: description || 'Recarga de Saldo',
                        quantity: 1,
                        unit_price: parseFloat(amount)
                    }
                ],
                payer: {
                    first_name: firstName ? firstName.trim() : '',
                    last_name: lastName ? lastName.trim() : '',
                    phone: {
                        area_code: areaCode,
                        number: phoneNumber
                    },
                    address: {
                        zip_code: address?.zip_code ? address.zip_code.replace(/\D/g, '') : '',
                        street_name: address?.street_name || '',
                        street_number: address?.street_number ? String(address.street_number) : ''
                    }
                }
            },
            notification_url: webhook_url || null,
            external_reference: external_reference || null
        };

        const requestOptions = {
            idempotencyKey: crypto.randomUUID(),
            meliSessionId: sessionId || null

        };

        const result = await payment.create({ body: paymentData, requestOptions });

        res.json({
            success: true,
            payment_id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            transaction_amount: result.transaction_amount,
            installments: result.installments
        });

    } catch (error) {
        console.error('Erro ao criar pagamento com cartão:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data || 'Erro interno do servidor'
        });
    }
});

// Endpoint para verificar status do pagamento
app.get('/payment_status/:payment_id', async (req, res) => {
    try {
        const { payment_id } = req.params;
        const result = await payment.get({ id: payment_id });
        
        res.json({
            success: true,
            status: result.status,
            status_detail: result.status_detail
        });
    } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Servidor rodando em http://localhost:${port}`);
    });
}

// Para Vercel
module.exports = app;
