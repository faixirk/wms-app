import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleSheet, ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface CutoutCardProps extends ViewProps {
    color?: string;
    cutoutWidth?: number;
    cutoutHeight?: number;
    cornerRadius?: number;
    cutoutRadius?: number;
    cutoutPosition?: 'bottomRight' | 'topRight';
}

export const CutoutCard: React.FC<CutoutCardProps> = ({
    color = '#095CD7',
    cutoutWidth = 96,
    cutoutHeight = 76,
    cornerRadius = 24,
    cutoutRadius = 24,
    cutoutPosition = 'bottomRight',
    style,
    children,
    ...props
}) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setDimensions({ width, height });
    };

    const W = dimensions.width;
    const H = dimensions.height;

    let path = '';
    if (W > 0 && H > 0) {
        const R = cornerRadius;
        const CR = cutoutRadius;
        const CW = cutoutWidth;
        const CH = cutoutHeight;

        if (cutoutPosition === 'bottomRight') {
            const R_TR = Math.min(R, (H - CH) / 2); // Top Right corner
            const R_Ledge = Math.min(R, (H - CH) / 2, CW / 2); // Outer ledge corner turning inward
            const R_Inner = Math.min(CR, CH / 2, CW / 2); // Inner concave corner turning downward
            const R_BL_cut = Math.min(R, CH / 2, (W - CW) / 2); // Bottom right corner at the cutout bounding box
            const R_BL = Math.min(R, H / 2, (W - CW) / 2); // Bottom Left corner
            const R_TL = Math.min(R, H / 2, W / 2); // Top Left corner

            path = `
                M ${R_TL} 0
                L ${W - R_TR} 0
                A ${R_TR} ${R_TR} 0 0 1 ${W} ${R_TR}
                L ${W} ${H - CH - R_Ledge}
                A ${R_Ledge} ${R_Ledge} 0 0 1 ${W - R_Ledge} ${H - CH}
                L ${W - CW + R_Inner} ${H - CH}
                A ${R_Inner} ${R_Inner} 0 0 0 ${W - CW} ${H - CH + R_Inner}
                L ${W - CW} ${H - R_BL_cut}
                A ${R_BL_cut} ${R_BL_cut} 0 0 1 ${W - CW - R_BL_cut} ${H}
                L ${R_BL} ${H}
                A ${R_BL} ${R_BL} 0 0 1 0 ${H - R_BL}
                L 0 ${R_TL}
                A ${R_TL} ${R_TL} 0 0 1 ${R_TL} 0
                Z
            `.replace(/\s+/g, ' ').trim();
        } else if (cutoutPosition === 'topRight') {
            const R_TL = Math.min(R, H / 2, W / 2);
            const R_BL = Math.min(R, H / 2, W / 2);
            const R_BR = Math.min(R, (H - CH) / 2, W / 2);
            const R_Ledge = Math.min(R, (H - CH) / 2, CW / 2);
            const R_Inner = Math.min(CR, CH / 2, CW / 2);
            const R_TR_cut = Math.min(R, CH / 2, (W - CW) / 2);

            path = `
                M ${R_TL} 0
                L ${W - CW - R_TR_cut} 0
                A ${R_TR_cut} ${R_TR_cut} 0 0 1 ${W - CW} ${R_TR_cut}
                L ${W - CW} ${CH - R_Inner}
                A ${R_Inner} ${R_Inner} 0 0 0 ${W - CW + R_Inner} ${CH}
                L ${W - R_Ledge} ${CH}
                A ${R_Ledge} ${R_Ledge} 0 0 1 ${W} ${CH + R_Ledge}
                L ${W} ${H - R_BR}
                A ${R_BR} ${R_BR} 0 0 1 ${W - R_BR} ${H}
                L ${R_BL} ${H}
                A ${R_BL} ${R_BL} 0 0 1 0 ${H - R_BL}
                L 0 ${R_TL}
                A ${R_TL} ${R_TL} 0 0 1 ${R_TL} 0
                Z
            `.replace(/\s+/g, ' ').trim();
        }
    }

    return (
        <View style={[styles.container, style]} onLayout={onLayout} {...props}>
            {W > 0 && H > 0 && (
                <View style={StyleSheet.absoluteFill}>
                    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                        <Path d={path} fill={color} />
                    </Svg>
                </View>
            )}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        minHeight: 120,
    },
    content: {
        flex: 1,
        zIndex: 1,
    }
});
