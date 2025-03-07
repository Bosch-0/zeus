import url from 'url';
import * as React from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';
import querystring from 'querystring-es3';

import Button from './../../components/Button';
import TextInput from './../../components/TextInput';

import InvoicesStore from './../../stores/InvoicesStore';
import LnurlPayStore from './../../stores/LnurlPayStore';

import LnurlPayMetadata from './Metadata';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface LnurlPayProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
    LnurlPayStore: LnurlPayStore;
}

interface LnurlPayState {
    amount: string;
    domain: string;
    comment: string;
}

@inject('InvoicesStore', 'SettingsStore', 'LnurlPayStore')
@observer
export default class LnurlPay extends React.Component<
    LnurlPayProps,
    LnurlPayState
> {
    constructor(props: LnurlPayProps) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {
                amount: '',
                domain: '',
                comment: ''
            };

            Alert.alert(
                localeString('views.LnurlPay.LnurlPay.invalidParams'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    stateFromProps(props: LnurlPayProps) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');

        return {
            amount: Math.floor(lnurl.minSendable / 1000).toString(),
            domain: lnurl.domain,
            comment: ''
        };
    }

    sendValues() {
        const { navigation, InvoicesStore, LnurlPayStore } = this.props;
        const { domain, amount, comment } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.amount = parseInt((parseFloat(amount) * 1000).toString());
        qs.comment = comment;
        u.search = querystring.stringify(qs);
        u.query = querystring.stringify(qs);

        ReactNativeBlobUtil.fetch('get', url.format(u))
            .then((response: any) => {
                try {
                    const data = response.json();
                    return data;
                } catch (err) {
                    return { status: 'ERROR', reason: response.text() };
                }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    Alert.alert(
                        `[error] ${domain} says:`,
                        data.reason,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
                    return;
                }

                const pr = data.pr;
                const successAction = data.successAction || {
                    tag: 'noop'
                };

                InvoicesStore.getPayReq(pr, lnurl.metadata).then(() => {
                    if (InvoicesStore.getPayReqError) {
                        Alert.alert(
                            localeString(
                                'views.LnurlPay.LnurlPay.invalidInvoice'
                            ),
                            InvoicesStore.getPayReqError,
                            [
                                {
                                    text: localeString('general.ok'),
                                    onPress: () => void 0
                                }
                            ],
                            { cancelable: false }
                        );
                        return;
                    }

                    const payment_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.payment_hash) ||
                        '';
                    const description_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.description_hash) ||
                        '';

                    LnurlPayStore.keep(
                        payment_hash,
                        domain,
                        lnurl.lnurlText,
                        lnurl.metadata,
                        description_hash,
                        successAction
                    );
                    navigation.navigate('PaymentRequest');
                });
            });
    }

    render() {
        const { navigation } = this.props;
        const { amount, domain, comment } = this.state;
        const lnurl = navigation.getParam('lnurlParams');

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Send',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText'),
                            padding: 20,
                            fontWeight: 'bold',
                            fontSize: 22
                        }}
                    >
                        {domain}
                    </Text>
                </View>
                <View style={styles.content}>
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.LnurlPay.LnurlPay.amount')}
                        {lnurl && lnurl.minSendable !== lnurl.maxSendable
                            ? ` (${Math.ceil(
                                  lnurl.minSendable / 1000
                              )}--${Math.floor(lnurl.maxSendable / 1000)})`
                            : ''}
                        {':'}
                    </Text>
                    <TextInput
                        value={amount}
                        onChangeText={(text: string) => {
                            this.setState({ amount: text });
                        }}
                        editable={
                            lnurl && lnurl.minSendable === lnurl.maxSendable
                                ? false
                                : true
                        }
                        style={styles.textInput}
                    />
                    {lnurl.commentAllowed > 0 ? (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.LnurlPay.LnurlPay.comment'
                                ) + ` (${lnurl.commentAllowed} char)`}
                                :
                            </Text>
                            <TextInput
                                value={comment}
                                onChangeText={(text: string) => {
                                    this.setState({ comment: text });
                                }}
                                style={styles.textInput}
                            />
                        </>
                    ) : null}
                    <View style={styles.button}>
                        <Button
                            title="Confirm"
                            icon={{
                                name: 'send',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => {
                                this.sendValues();
                            }}
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: 'orange',
                                borderRadius: 30
                            }}
                        />
                    </View>
                </View>
                <View style={styles.content}>
                    <LnurlPayMetadata metadata={lnurl.metadata} />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    textInput: {
        paddingTop: 10,
        paddingBottom: 10
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
