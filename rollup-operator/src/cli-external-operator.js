const axios = require("axios");

class CliExternalOperator {

    constructor(url) {
        this.url = url;
    }

    getInfoByIdx(id) {
        return axios.get(`${this.url}/info/id/${id}`);
    }

    getInfoByAxAy(ax, ay) {
        return axios.get(`${this.url}/info/axay/${ax}/${ay}`);
    }

    getInfoByEthAddr(ethAddress) {
        return axios.get(`${this.url}/info/ethaddress/${ethAddress}`);
    }

    state() {
        return axios.get(`${this.url}/state`);
    }

    sendOffChainTx(tx) {
        return axios.post(`${this.url}/offchain/send`, tx);
    }

    getGeneralInfo() {
        return axios.get(`${this.url}/info/general`);
    }

    getOperatorsList() {
        return axios.get(`${this.url}/info/operators`);
    }
}

module.exports = CliExternalOperator;
