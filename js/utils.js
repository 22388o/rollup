const Scalar = require("ffjavascript").Scalar;
const poseidon = require("circomlib").poseidon;
const eddsa = require("circomlib").eddsa;

function extract(num, origin, len) {
    const mask = Scalar.sub(Scalar.shl(1, len), 1);
    return Scalar.band(Scalar.shr(num, origin), mask);
}

function padZeros(str, length) {
    if (length > str.length)
        str = "0".repeat(length - str.length) + str;
    return str;
}

function float2fix(fl) {
    const m = (fl & 0x3FF);
    const e = (fl >> 11);
    const e5 = (fl >> 10) & 1;

    const exp = Scalar.pow(10, e);

    let res = Scalar.mul(m, exp);
    if (e5 && e) {
        res = Scalar.add(res, Scalar.div(exp, 2));
    }
    return res;
}

function fix2float(_f) {
    const f = Scalar.e(_f);

    function floorFix2Float(_f) {
        const f = Scalar.e(_f);
        if (Scalar.isZero(f)) return 0;

        let m = f;
        let e = 0;

        while (!Scalar.isZero(Scalar.shr(m, 10))) {
            m = Scalar.div(m, 10);
            e++;
        }

        const res = Scalar.toNumber(m) + (e << 11);
        return res;
    }

    function dist(n1, n2) {
        const tmp = Scalar.sub(n1, n2);

        return Scalar.abs(tmp);
    }

    const fl1 = floorFix2Float(f);
    const fi1 = float2fix(fl1);
    const fl2 = fl1 | 0x400;
    const fi2 = float2fix(fl2);

    let m3 = (fl1 & 0x3FF) + 1;
    let e3 = (fl1 >> 11);
    if (m3 == 0x400) {
        m3 = 0x66; // 0x400 / 10
        e3++;
    }
    const fl3 = m3 + (e3 << 11);
    const fi3 = float2fix(fl3);

    let res = fl1;
    let d = dist(fi1, f);

    let d2 = dist(fi2, f);
    if (Scalar.gt(d, d2)) {
        res = fl2;
        d = d2;
    }

    let d3 = dist(fi3, f);
    if (Scalar.gt(d, d3)) {
        res = fl3;
    }

    return res;
}

function buildTxData(tx) {
    const IDEN3_ROLLUP_TX = Scalar.fromString("4839017969649077913");
    let res = Scalar.e(0);

    res = Scalar.add(res, IDEN3_ROLLUP_TX);
    res = Scalar.add(res, Scalar.shl(fix2float(tx.amount || 0), 64));
    res = Scalar.add(res, Scalar.shl(tx.coin || 0, 80));
    res = Scalar.add(res, Scalar.shl(tx.nonce || 0, 112));
    res = Scalar.add(res, Scalar.shl(fix2float(tx.userFee || 0), 160));
    res = Scalar.add(res, Scalar.shl(tx.rqOffset || 0, 176));
    res = Scalar.add(res, Scalar.shl(tx.onChain ? 1 : 0, 179));
    res = Scalar.add(res, Scalar.shl(tx.newAccount ? 1 : 0, 180));

    return res;
}

function decodeTxData(txDataEncoded) {
    const txDataBi = Scalar.fromString(txDataEncoded);
    let txData = {};

    txData.amount = float2fix(Scalar.toNumber(extract(txDataBi, 64, 16)));
    txData.coin = extract(txDataBi, 80, 32);
    txData.nonce = extract(txDataBi, 112, 48);
    txData.userFee = float2fix(Scalar.toNumber(extract(txDataBi, 160, 16)));
    txData.rqOffset = extract(txDataBi, 176, 3);
    txData.onChain = Scalar.isZero(extract(txDataBi, 179, 1)) ? false : true;
    txData.newAccount = Scalar.isZero(extract(txDataBi, 180, 1)) ? false : true;

    return txData;
}

function txRoundValues(tx) {
    tx.amountF = fix2float(tx.amount);
    tx.amount = float2fix(tx.amountF);
    tx.userFeeF = fix2float(tx.userFee);
    tx.userFee = float2fix(tx.userFeeF);
}

function state2array(st) {
    let data = Scalar.e(0);
    
    data = Scalar.add(data, st.coin);
    data = Scalar.add(data, Scalar.shl(st.nonce, 32));

    return [
        data,
        Scalar.e(st.amount),
        Scalar.fromString(st.ax, 16),
        Scalar.fromString(st.ay, 16),
        Scalar.fromString(st.ethAddress, 16),
    ];
}

function array2state(a) {
    return {
        coin: Scalar.toNumber(extract(a[0], 0, 32)),
        nonce: Scalar.toNumber(extract(a[0], 32, 48)),
        amount: Scalar.e(a[1]),
        ax: Scalar.e(a[2]).toString(16),
        ay: Scalar.e(a[3]).toString(16),
        ethAddress: "0x" + padZeros(Scalar.e(a[4]).toString(16), 40),
    };
}

function hashState(st) {
    const hash = poseidon.createHash(6, 8, 57);

    return hash(state2array(st));
}

function verifyTxSig(tx) {
    try {
        const data = buildTxData(tx);
        const hash = poseidon.createHash(6, 8, 57);

        const h = hash([
            data,
            tx.rqTxData || 0,
            Scalar.fromString(tx.toAx, 16),
            Scalar.fromString(tx.toAy, 16),
            Scalar.fromString(tx.toEthAddr, 16),
        ]);
        const signature = {
            R8: [Scalar.e(tx.r8x), Scalar.e(tx.r8y)],
            S: Scalar.e(tx.s)
        };

        const pubKey = [Scalar.fromString(tx.fromAx, 16), Scalar.fromString(tx.fromAy, 16)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch (E) {
        console.log("Enter here");
        return false;
    }
}

function hashIdx(coin, ax, ay) {
    const h = poseidon.createHash(6, 8, 57);
    return h([Scalar.e(coin), Scalar.fromString(ax, 16), Scalar.fromString(ay, 16)]);
}

function encodeDepositOffchain(depositsOffchain) {
    let buffer = Buffer.alloc(0);
    for (let i=0; i<depositsOffchain.length; i++) {
        buffer = Buffer.concat([
            buffer,
            bigInt("0x" + depositsOffchain[i].fromAx).beInt2Buff(32),
            bigInt("0x" + depositsOffchain[i].fromAy).beInt2Buff(32),
            bigInt(depositsOffchain[i].fromEthAddr).beInt2Buff(20),
            bigInt(depositsOffchain[i].coin).beInt2Buff(4),
        ]);
    }
    
    return buffer;
}

function isStrHex(input) {
    if (typeof (input) == "string" && input.slice(0, 2) == "0x") {
        return true;
    }
    return false;
}

module.exports.padZeros = padZeros;
module.exports.buildTxData = buildTxData;
module.exports.decodeTxData = decodeTxData;
module.exports.fix2float = fix2float;
module.exports.float2fix = float2fix;
module.exports.hashState = hashState;
module.exports.state2array = state2array;
module.exports.array2state = array2state;
module.exports.txRoundValues = txRoundValues;
module.exports.verifyTxSig = verifyTxSig;
module.exports.hashIdx = hashIdx;
module.exports.isStrHex = isStrHex; 
module.exports.extract = extract;
module.exports.encodeDepositOffchain = encodeDepositOffchain;