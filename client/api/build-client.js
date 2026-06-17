import axios from 'axios';

const buildClient = ({ req }) => {
    if (typeof window === 'undefined') {
        // Called server side: access via ingress and attach headers (e.g. cookie)
        return axios.create({
            baseURL: 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local',
            headers: req.headers
        });
    }

    // Called from browser -- it'll prepend the base url and handle headers
    return axios.create();
}

export default buildClient;