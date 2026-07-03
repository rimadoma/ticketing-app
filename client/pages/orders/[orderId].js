import { useState, useEffect } from 'react';
import Router from 'next/router';
import { CURRENCIES, STATUS_LABELS } from '../../constants';
import ErrorAlert from '../../components/error-alert';
import PaymentForm from '../../components/payment-form';
import useRequest from '../../hooks/use-request';

const OrderShow = ({ order, errors }) => {
    if (!order) return <div><ErrorAlert errors={errors} /></div>;

    const [secondsLeft, setSecondsLeft] = useState(() =>
        Math.floor((new Date(order.expiresAt) - new Date()) / 1000)
    );
    const { doRequest: cancelOrder, errors: cancelErrors } = useRequest({
        url: `/api/orders/${order.id}`,
        method: 'delete',
        onSuccess: () => Router.push('/orders')
    });

    const isPendingOrder = order.status !== 'complete' && order.status !== 'cancelled';

    useEffect(() => {
        if (!isPendingOrder) return;

        const timer = setInterval(() => {
            setSecondsLeft(s => s - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const renderPayment = () => {
        if (!isPendingOrder) return null;
        if (secondsLeft <= 0) return <p className="text-danger">Sorry, but your order has expired.</p>;

        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        return (
            <div>
                <p>{minutes}m {seconds}s left to complete your purchase</p>
                <PaymentForm orderId={order.id} onSuccess={() => Router.push('/orders')} />
            </div>
        );
    };

    const { ticket } = order;
    const symbol = CURRENCIES.find(c => c.code === ticket.price.currency)?.symbol ?? '';
    const price = `${symbol}${ticket.price.amount}`;

    return (
        <div>
            <h1>Your order for "{ticket.title}"</h1>
            <h4>Price: {price}</h4>
            <h4>Status: {STATUS_LABELS[order.status] ?? order.status}</h4>
            {renderPayment()}
            {isPendingOrder && <button onClick={cancelOrder} className="btn btn-outline-danger">Cancel</button>}
            <ErrorAlert errors={cancelErrors} />
        </div>
    );
};

OrderShow.getInitialProps = async (context, client, currentUser) => {
    if (!currentUser) {
        if (typeof window === 'undefined') {
            context.res.writeHead(302, { Location: '/auth/signin' });
            context.res.end();
        } else {
            Router.push('/auth/signin');
        }
        return {};
    }

    const { orderId } = context.query;
    try {
        const { data } = await client.get(`/api/orders/${orderId}`);
        return { order: data };
    } catch (err) {
        const status = err.response?.status;
        const errors = status === 404 ? [{ message: "You're not authorised to view this order." }]
            : err.response?.data?.errors ?? [{ message: 'Something went wrong' }];
        return { errors };
    }
};

export default OrderShow;
