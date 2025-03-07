import * as React from 'react';
import {
    Animated,
    PanResponder,
    Text,
    TouchableOpacity,
    View,
    Linking
} from 'react-native';

import { inject, observer } from 'mobx-react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RNRestart from 'react-native-restart';

import ChannelsPane from '../Channels/ChannelsPane';
import MainPane from './MainPane';

import Button from './../../components/Button';
import LayerBalances from './../../components/LayerBalances';
import LoadingIndicator from './../../components/LoadingIndicator';

import RESTUtils from './../../utils/RESTUtils';
import LinkingUtils from './../../utils/LinkingUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';

import NodeInfoStore from './../../stores/NodeInfoStore';
import SettingsStore from './../../stores/SettingsStore';
import FiatStore from './../../stores/FiatStore';
import UnitsStore from './../../stores/UnitsStore';
import UTXOsStore from './../../stores/UTXOsStore';

import Temple from './../../assets/images/SVG/Temple.svg';
import ChannelsIcon from './../../assets/images/SVG/Channels.svg';
import CaretUp from './../../assets/images/SVG/Caret Up.svg';
import WordLogo from './../../assets/images/SVG/Word Logo - no outline.svg';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
    UTXOsStore: UTXOsStore;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'NodeInfoStore',
    'FeeStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore',
    'UTXOsStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, {}> {
    constructor(props) {
        super(props);
        this.pan = new Animated.ValueXY();
        this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: this.pan.x, dy: this.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                Animated.spring(this.pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false
                }).start();
                props.navigation.navigate('Activity');
            }
        });
    }

    componentDidMount() {
        Linking.addEventListener('url', this.handleOpenURL);
        LinkingUtils.handleInitialUrl(this.props.navigation);

        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.getSettingsAndNavigate();
        });
    }

    async getSettingsAndNavigate() {
        const { SettingsStore, navigation } = this.props;

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then((settings: any) => {
            const loginRequired =
                settings &&
                (settings.passphrase || settings.pin) &&
                !SettingsStore.loggedIn;
            if (loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
                this.fetchData();
            } else {
                navigation.navigate('IntroSplash');
            }
        });
    }

    async refresh() {
        const { NodeInfoStore, BalanceStore, ChannelsStore, SettingsStore } =
            this.props;

        if (SettingsStore.connecting) {
            NodeInfoStore.reset();
            BalanceStore.reset();
            ChannelsStore.reset();
        }

        this.getSettingsAndNavigate();
    }

    async fetchData() {
        const {
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            FeeStore,
            UTXOsStore,
            SettingsStore,
            FiatStore
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login,
            connecting,
            setConnectingStatus
        } = SettingsStore;
        const { fiat } = settings;

        if (!!fiat && fiat !== 'Disabled') {
            FiatStore.getFiatRates();
        }

        if (implementation === 'lndhub') {
            BalanceStore.reset();
            login({ login: username, password }).then(async () => {
                BalanceStore.getLightningBalance(true);
            });
        } else {
            if (RESTUtils.supportsAccounts()) {
                UTXOsStore.listAccounts();
            }

            await BalanceStore.getCombinedBalance();
            ChannelsStore.getChannels();
            FeeStore.getFees();
            NodeInfoStore.getNodeInfo();
        }

        if (implementation === 'lnd') {
            FeeStore.getForwardingHistory();
        }

        if (connecting) {
            setConnectingStatus(false);
        }
    }

    handleOpenURL = (event: any) => {
        const { navigation } = this.props;
        if (event.url) {
            LinkingUtils.handleDeepLink(event.url, navigation);
        }
    };

    render() {
        const Tab = createBottomTabNavigator();
        const {
            NodeInfoStore,
            UnitsStore,
            BalanceStore,
            SettingsStore,
            navigation
        } = this.props;
        const { error, nodeInfo } = NodeInfoStore;
        const { implementation, settings, loggedIn, connecting } =
            SettingsStore;
        const loginRequired =
            !settings ||
            (settings && (settings.passphrase || settings.pin) && !loggedIn);
        const dataAvailable = implementation === 'lndhub' || nodeInfo.version;

        const WalletScreen = () => {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        flex: 1
                    }}
                >
                    <MainPane
                        navigation={navigation}
                        NodeInfoStore={NodeInfoStore}
                        UnitsStore={UnitsStore}
                        BalanceStore={BalanceStore}
                        SettingsStore={SettingsStore}
                    />

                    {error && (
                        <View style={{ backgroundColor: themeColor('error') }}>
                            <Button
                                title={localeString('views.Wallet.restart')}
                                icon={{
                                    name: 'sync',
                                    size: 25
                                }}
                                onPress={() => RNRestart.Restart()}
                            />
                        </View>
                    )}

                    {dataAvailable && (
                        <>
                            <LayerBalances
                                navigation={navigation}
                                BalanceStore={BalanceStore}
                                UnitsStore={UnitsStore}
                                onRefresh={() => this.refresh()}
                            />

                            <Animated.View
                                style={{
                                    flex: 1,
                                    justifyContent: 'flex-end',
                                    alignSelf: 'center',
                                    bottom: 10,
                                    paddingTop: 40,
                                    paddingBottom: 35,
                                    width: '100%',
                                    transform: [{ translateY: this.pan.y }],
                                    alignItems: 'center'
                                }}
                                {...this.panResponder.panHandlers}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        this.props.navigation.navigate(
                                            'Activity'
                                        )
                                    }
                                >
                                    <CaretUp
                                        stroke={themeColor('text')}
                                        fill={themeColor('text')}
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                        </>
                    )}
                </View>
            );
        };

        const ChannelsScreen = () => {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        flex: 1
                    }}
                >
                    <ChannelsPane navigation={navigation} />
                </View>
            );
        };

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                card: error ? themeColor('error') : themeColor('background'),
                border: error ? themeColor('error') : themeColor('background')
            }
        };

        return (
            <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }}>
                    {!connecting && !loginRequired && (
                        <NavigationContainer theme={Theme}>
                            <Tab.Navigator
                                screenOptions={({ route }) => ({
                                    tabBarIcon: ({ color }) => {
                                        if (route.name === 'Wallet') {
                                            return <Temple fill={color} />;
                                        }
                                        if (
                                            RESTUtils.supportsChannelManagement()
                                        ) {
                                            return (
                                                <ChannelsIcon fill={color} />
                                            );
                                        }
                                    }
                                })}
                                tabBarOptions={{
                                    activeTintColor: error
                                        ? themeColor('error')
                                        : themeColor('text'),
                                    inactiveTintColor: error
                                        ? themeColor('error')
                                        : RESTUtils.supportsChannelManagement()
                                        ? 'gray'
                                        : themeColor('highlight'),
                                    showLabel: false
                                }}
                            >
                                <Tab.Screen
                                    name="Wallet"
                                    component={WalletScreen}
                                />
                                {RESTUtils.supportsChannelManagement() &&
                                !error ? (
                                    <Tab.Screen
                                        name={localeString(
                                            'views.Wallet.Wallet.channels'
                                        )}
                                        component={ChannelsScreen}
                                    />
                                ) : (
                                    <Tab.Screen
                                        name={' '}
                                        component={WalletScreen}
                                    />
                                )}
                            </Tab.Navigator>
                        </NavigationContainer>
                    )}
                    {connecting && !loginRequired && (
                        <View
                            style={{
                                backgroundColor: '#1F242D',
                                height: '100%'
                            }}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    top: 50
                                }}
                            >
                                <WordLogo
                                    height={100}
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                />
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular',
                                        alignSelf: 'center',
                                        fontSize: 15,
                                        padding: 8
                                    }}
                                >
                                    {settings.nodes
                                        ? localeString(
                                              'views.Wallet.Wallet.connecting'
                                          )
                                        : localeString(
                                              'views.Wallet.Wallet.startingUp'
                                          )}
                                </Text>
                                <LoadingIndicator size={120} />
                            </View>
                            <View
                                style={{
                                    bottom: 56
                                }}
                            >
                                <Button
                                    title={
                                        settings.nodes
                                            ? localeString(
                                                  'views.Settings.title'
                                              )
                                            : null
                                    }
                                    containerStyle={{
                                        width: 320
                                    }}
                                    titleStyle={{
                                        color: 'white'
                                    }}
                                    onPress={() => {
                                        if (settings.nodes)
                                            navigation.navigate('Settings');
                                    }}
                                    adaptiveWidth
                                    iconOnly
                                />
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    }
}
