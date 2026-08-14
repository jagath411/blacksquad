import { Pressable,StyleSheet,Text,type PressableProps,type TextStyle,type ViewStyle } from 'react-native';
import { colors } from '../constants/theme';
interface Props extends PressableProps{label:string;variant?:'primary'|'secondary'}
export function AppButton({label,variant='primary',...props}:Props){return <Pressable {...props} style={({pressed})=>[s.base,variant==='secondary'&&s.secondary,pressed&&s.pressed]}><Text style={[s.label,variant==='secondary'&&s.secondaryLabel]}>{label}</Text></Pressable>}
const s=StyleSheet.create<{base:ViewStyle;secondary:ViewStyle;pressed:ViewStyle;label:TextStyle;secondaryLabel:TextStyle}>({base:{minHeight:54,borderRadius:16,backgroundColor:colors.green,alignItems:'center',justifyContent:'center',paddingHorizontal:22},secondary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},pressed:{opacity:.78},label:{color:'#062116',fontWeight:'800',fontSize:16},secondaryLabel:{color:colors.text}});
