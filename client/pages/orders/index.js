import Link from 'next/link';
import Router from 'next/router';
import { CURRENCIES, STATUS_LABELS } from '../../constants';
import ErrorAlert from '../../components/error-alert';

const OrdersPage = ({ orders, errors }) => {
    if (!orders) return <div><ErrorAlert errors={errors} /></div>;
    if (!orders.length) return <div><h1>My Orders</h1><p>You have no orders</p></div>;

    const rows = orders.map(order => {
        const { ticket } = order;
        const symbol = CURRENCIES.find(c => c.code === ticket.price.currency)?.symbol ?? '';
        const price = `${symbol}${ticket.price.amount}`;
        const orderUrl = `/orders/${order.id}`;

        return (
            <tr key={order.id}>
                <td>{ticket.title}</td>
                <td>{price}</td>
                <td>{STATUS_LABELS[order.status] ?? order.status}</td>
                <td><Link href={orderUrl}>View</Link></td>
            </tr>
        );
    });

    return (
        <div>
            <h1>My Orders</h1>
            <table className="table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
    );
};

OrdersPage.getInitialProps = async (context, client, currentUser) => {
    if (!currentUser) {
        if (typeof window === 'undefined') {
            context.res.writeHead(302, { Location: '/auth/signin' });
            context.res.end();
        } else {
            Router.push('/auth/signin');
        }
        return { orders: [] };
    }

    try {
        const { data } = await client.get('/api/orders');
        return { orders: data };
    } catch (err) {
        return { errors: [{ message: 'Something went wrong' }] };
    }
};

export default OrdersPage;
