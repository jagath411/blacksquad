import type { PropsWithChildren } from 'react';
import { SafeAreaView,ScrollView,StyleSheet,View } from 'react-native';
import { colors } from '../constants/theme';
export function Screen({children}:PropsWithChildren){return <SafeAreaView style={s.safe}><View style={s.glow}/><ScrollView contentContainerStyle={s.content}>{children}</ScrollView></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},glow:{position:'absolute',width:360,height:360,borderRadius:180,top:-190,right:-130,backgroundColor:'#174632',opacity:.65},content:{flexGrow:1,width:'100%',maxWidth:560,alignSelf:'center',padding:24}});
