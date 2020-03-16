import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import ModalError from './modal-error';
import ButtonGM from './gm-buttons';
import { handleSendWithdraw } from '../../../state/tx/actions';
import { handleStateWithdraw } from '../../../state/tx-state/actions';

class ModalWithdraw extends Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
    abiRollup: PropTypes.array.isRequired,
    modalWithdraw: PropTypes.bool.isRequired,
    toggleModalWithdraw: PropTypes.func.isRequired,
    handleSendWithdraw: PropTypes.func.isRequired,
    handleStateWithdraw: PropTypes.func.isRequired,
    gasMultiplier: PropTypes.number.isRequired,
    desWallet: PropTypes.object.isRequired,
    txsExits: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      exitRoots: [],
      numExitRoot: -1,
      idFrom: -1,
      initModal: true,
      modalError: false,
      nextDisabled: true,
      error: '',
    };
    this.idFromRef = React.createRef();
  }

  toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

  handleClick = async () => {
    const {
      config, abiRollup, desWallet, gasMultiplier,
    } = this.props;

    const idFrom = Number(this.state.idFrom);
    const numExitRoot = Number(this.state.numExitRoot);
    const { nodeEth } = config;
    const addressSC = config.address;
    const { operator } = config;
    this.toggleModalChange();
    this.props.toggleModalWithdraw();
    const res = await this.props.handleSendWithdraw(nodeEth, addressSC, desWallet,
      abiRollup, operator, idFrom, numExitRoot, gasMultiplier);
    if (res !== undefined) {
      if (res.message !== undefined) {
        if (res.message.includes('insufficient funds')) {
          this.setState({ error: '1' });
          this.toggleModalError();
        }
      }
      if (res.res) {
        this.props.handleStateWithdraw(res, idFrom);
      }
    }
  }

  getExitRoot = async () => {
    const { txsExits } = this.props;
    const txsExitsById = txsExits.filter((tx) => tx.idx === this.state.idFrom);
    const exitRoots = [];
    txsExitsById.map(async (key, index) => {
      exitRoots.push({
        key: index, value: key.batch, text: `Batch: ${key.batch} Amount: ${key.amount}`,
      });
    });
    this.setState({ exitRoots }, () => { this.toggleModalChange(); });
  }

  idsExit = () => {
    const { txsExits } = this.props;
    const infoTxsExits = [];
    for (const i in txsExits) {
      if ({}.hasOwnProperty.call(txsExits, i)) {
        const tx = txsExits[i];
        if (!infoTxsExits.find((leaf) => leaf.value === tx.idx)) {
          infoTxsExits.push({
            key: i, value: tx.idx, text: tx.idx,
          });
        }
      }
    }
    let dropdown;
    if (infoTxsExits.length === 0) {
      dropdown = (<Dropdown placeholder="ID" />);
    } else {
      dropdown = (
        <Dropdown
          scrolling
          placeholder="ID"
          options={infoTxsExits}
          onChange={this.handleChangeIdFrom} />
      );
    }
    return dropdown;
  }

  handleChangeIdFrom = (e, { value }) => this.setState({ idFrom: value, nextDisabled: false });

  exitRoot = () => {
    let dropdown;
    if (this.state.exitRoots.length === 0) {
      dropdown = (<Dropdown placeholder="Batch and Amount" />);
    } else {
      dropdown = (
        <Dropdown
          scrolling
          placeholder="Batch and Amount"
          options={this.state.exitRoots}
          onChange={this.handleChange} />
      );
    }
    return dropdown;
  }

  handleChange = (e, { value }) => this.setState({ numExitRoot: value })

  modal = () => {
    if (this.state.initModal === true) {
      return (
        <Modal open={this.props.modalWithdraw}>
          <Modal.Header>Withdraw</Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <p><b>ID From</b></p>
                {this.idsExit()}
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.getExitRoot} disabled={this.state.nextDisabled}>
              <Icon name="arrow right" />
                Next
            </Button>
            <Button color="grey" basic onClick={this.props.toggleModalWithdraw}>
              <Icon name="close" />
                Close
            </Button>
          </Modal.Actions>
        </Modal>
      );
    }
    return (
      <Modal open={this.props.modalWithdraw}>
        <Modal.Header>Withdraw</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field>
              <p><b>ID From</b></p>
              <p>{this.state.idFrom}</p>
            </Form.Field>
            <Form.Field>
              <p><b>Batch and Amount</b></p>
              {this.exitRoot()}
            </Form.Field>
            <Form.Field>
              <ButtonGM />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" onClick={this.toggleModalChange}>
            <Icon name="arrow left" />
              Previous
          </Button>
          <Button color="blue" onClick={this.handleClick}>
            <Icon name="sign-out" />
              Withdraw
          </Button>
          <Button color="grey" basic onClick={this.toogleCloseModal}>
            <Icon name="close" />
              Close
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  toggleModalChange = () => { this.setState((prev) => ({ initModal: !prev.initModal })); }

  toogleCloseModal = () => { this.toggleModalChange(); this.props.toggleModalWithdraw(); }

  render() {
    return (
      <div>
        <ModalError
          error={this.state.error}
          modalError={this.state.modalError}
          toggleModalError={this.toggleModalError} />
        {this.modal()}
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  config: state.general.config,
  abiRollup: state.general.abiRollup,
  desWallet: state.general.desWallet,
  txsExits: state.general.txsExits,
  gasMultiplier: state.general.gasMultiplier,
});

export default connect(mapStateToProps, { handleSendWithdraw, handleStateWithdraw })(ModalWithdraw);
