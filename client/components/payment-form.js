import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import ErrorAlert from './error-alert';

const STRIPE_CLIENT_KEY = 'pk_test_51Tl6I2Gfzu9nqt9KNyAEkH5M26JCU5OmPXRfeCSht9DCGpqBLDUdHA7MlIs7pIHSUlYARkBstIn7mg2YmFUcgfLB00eBLtn9As';
const stripePromise = loadStripe(STRIPE_CLIENT_KEY);

const CardForm = ({ orderId, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errors, setErrors] = useState(null);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErrors(null);

        const { paymentMethod, error } = await stripe.createPaymentMethod({
            type: 'card',
            card: elements.getElement(CardElement),
        });

        if (error) {
            setErrors([{ message: error.message }]);
            return;
        }

        try {
            await axios.post('/api/payments', { orderId, paymentMethodId: paymentMethod.id });
            onSuccess();
        } catch (err) {
            setErrors(err.response?.data?.errors ?? [{ message: 'Payment failed' }]);
        }
    };

    return (
        <form onSubmit={onSubmit}>
            <CardElement />
            <button className="btn btn-primary mt-2">Pay now</button>
            <ErrorAlert errors={errors} />
        </form>
    );
};

const PaymentForm = ({ orderId, onSuccess }) => (
    <Elements stripe={stripePromise}>
        <CardForm orderId={orderId} onSuccess={onSuccess} />
    </Elements>
);

export default PaymentForm;
