import Link from 'next/link';
import Router from 'next/router';
import { CURRENCIES } from '../../constants';
import useRequest from '../../hooks/use-request';
import ErrorAlert from '../../components/error-alert';

const TicketShow = ({ ticket, currentUser }) => {
    const {doRequest, errors } = useRequest({
        url: '/api/orders',
        method: 'post',
        body: { ticketId: ticket.id },
        onSuccess: (order) => Router.push(`/orders/${order.id}`)
    });

    const symbol = CURRENCIES.find(c => c.code === ticket.price.currency)?.symbol ?? '';
    const price = `${symbol}${ticket.price.amount}`;
    // TODO show whether ticket is free, reserved, or sold
    return (
        <div>
            <h1>{ticket.title}</h1>
            <h4>Price: {price}</h4>
            <button onClick={doRequest} className="btn btn-primary" disabled={!currentUser || !!ticket.reservingOrderId}>Order now</button>
            {!currentUser && <p className="mt-2"><Link href="/auth/signin">Sign in to buy now!</Link></p>}
            <ErrorAlert errors={errors} />
        </div>
    );
};

TicketShow.getInitialProps = async (context, client, currentUser) => {
    const { ticketId } = context.query;
    const { data } = await client.get(`/api/tickets/${ticketId}`);

    return { ticket: data };
}

export default TicketShow;
