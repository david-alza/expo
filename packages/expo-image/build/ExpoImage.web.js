import React from 'react';
import { ImageTransitionEffect, ImageTransitionTiming, } from './Image.types';
function ensureUnit(value) {
    const trimmedValue = String(value).trim();
    if (trimmedValue.endsWith('%')) {
        return trimmedValue;
    }
    return `${trimmedValue}px`;
}
function getObjectPositionFromContentPositionObject(contentPosition) {
    const resolvedPosition = { ...contentPosition };
    if (!resolvedPosition) {
        return '50% 50%';
    }
    if (resolvedPosition.top == null && resolvedPosition.bottom == null) {
        resolvedPosition.top = '50%';
    }
    if (resolvedPosition.left == null && resolvedPosition.right == null) {
        resolvedPosition.left = '50%';
    }
    return (['top', 'bottom', 'left', 'right']
        .map((key) => {
        if (key in resolvedPosition) {
            return `${key} ${ensureUnit(resolvedPosition[key])}`;
        }
        return '';
    })
        .join(' ') || '50% 50%');
}
function useImageState(source) {
    const hasAnySource = source && source.length > 0;
    const [imageState, setImageState] = React.useState(hasAnySource ? 'loading' : 'empty');
    React.useEffect(() => {
        setImageState((prevState) => prevState === 'empty' ? (hasAnySource ? 'loading' : 'empty') : prevState);
    }, [hasAnySource]);
    const onLoad = React.useCallback(() => setImageState((prevState) => (imageState === 'loading' ? 'loaded' : prevState)), []);
    const handlers = React.useMemo(() => ({
        onLoad,
    }), [onLoad]);
    return [imageState, handlers];
}
function getCSSTiming(timing) {
    return ({
        [ImageTransitionTiming.EASE_IN]: 'ease-in',
        [ImageTransitionTiming.EASE_OUT]: 'ease-out',
        [ImageTransitionTiming.EASE_IN_OUT]: 'ease-in-out',
        [ImageTransitionTiming.LINEAR]: 'linear',
    }[timing || ImageTransitionTiming.LINEAR] ?? 'linear');
}
function getTransitionObjectFromTransition(transition) {
    if (transition == null) {
        return {
            timing: ImageTransitionTiming.LINEAR,
            duration: 0,
            effect: ImageTransitionEffect.NONE,
        };
    }
    if (typeof transition === 'number') {
        return {
            timing: ImageTransitionTiming.EASE_IN_OUT,
            duration: transition,
            effect: ImageTransitionEffect.CROSS_DISOLVE,
        };
    }
    return {
        timing: ImageTransitionTiming.EASE_IN_OUT,
        duration: 1000,
        ...transition,
    };
}
function useTransition(transition, state) {
    const { duration, timing, effect } = getTransitionObjectFromTransition(transition);
    if (effect === ImageTransitionEffect.CROSS_DISOLVE) {
        const commonStyles = {
            transition: `opacity ${duration}ms`,
            transitionTimingFunction: getCSSTiming(timing),
        };
        return {
            image: {
                opacity: state === 'loaded' ? '1' : '0',
                ...commonStyles,
            },
            placeholder: {
                opacity: state === 'loaded' ? '0' : '1',
                ...commonStyles,
            },
        };
    }
    if (effect === ImageTransitionEffect.FLIP_FROM_TOP) {
        const commonStyles = {
            transition: `transform ${duration}ms`,
            transformOrigin: 'top',
            transitionTimingFunction: getCSSTiming(timing),
        };
        return {
            placeholder: {
                transform: `rotateX(${state !== 'loaded' ? '0' : '90deg'})`,
                ...commonStyles,
            },
            image: {
                transform: `rotateX(${state === 'loaded' ? '0' : '90deg'})`,
                ...commonStyles,
            },
        };
    }
    return { placeholder: {}, image: {} };
}
function findBestSourceForSize(sources, size) {
    return ([...(sources || [])]
        // look for the smallest image that's still larger then a container
        ?.map((source) => {
        if (!size) {
            return { source, penalty: 0, covers: false };
        }
        const { width, height } = typeof source === 'object' ? source : { width: null, height: null };
        if (width == null || height == null) {
            return { source, penalty: 0, covers: false };
        }
        if (width < size.width || height < size.height) {
            return {
                source,
                penalty: Math.max(size.width - width, size.height - height),
                covers: false,
            };
        }
        return { source, penalty: (width - size.width) * (height - size.height), covers: true };
    })
        .sort((a, b) => a.penalty - b.penalty)
        .sort((a, b) => Number(b.covers) - Number(a.covers))[0]?.source ?? null);
}
;
function useSourceSelection(sources, sizeCalculation = 'live') {
    const hasMoreThanOneSource = (sources?.length ?? 0) > 1;
    // null - not calculated yet, DOMRect - size available
    const [size, setSize] = React.useState(null);
    const resizeObserver = React.useRef(null);
    React.useEffect(() => {
        return () => {
            resizeObserver.current?.disconnect();
        };
    }, []);
    const containerRef = React.useCallback((element) => {
        if (!hasMoreThanOneSource) {
            return;
        }
        setSize(element?.getBoundingClientRect());
        if (sizeCalculation === 'live') {
            resizeObserver.current?.disconnect();
            if (!element) {
                return;
            }
            resizeObserver.current = new ResizeObserver((entries) => {
                setSize(entries[0].contentRect);
            });
            resizeObserver.current.observe(element);
        }
    }, [hasMoreThanOneSource]);
    const bestSourceForSize = size !== undefined ? findBestSourceForSize(sources, size) : null;
    const source = (hasMoreThanOneSource ? bestSourceForSize : sources?.[0]) ?? null;
    return React.useMemo(() => ({
        containerRef,
        source,
    }), [source]);
}
;
export default function ExpoImage({ source, placeholder, contentFit, contentPosition, onLoad, transition, onLoadStart, onLoadEnd, onError, webResponsivePolicy, ...props }) {
    const { aspectRatio, backgroundColor, transform, borderColor, ...style } = props.style ?? {};
    const [state, handlers] = useImageState(source);
    const { placeholder: placeholderStyle, image: imageStyle } = useTransition(transition, state);
    const { containerRef, source: selectedSource } = useSourceSelection(source, webResponsivePolicy);
    return (React.createElement("div", { ref: containerRef, style: {
            aspectRatio: String(aspectRatio),
            backgroundColor: backgroundColor?.toString(),
            transform: transform?.toString(),
            borderColor: borderColor?.toString(),
            ...style,
            overflow: 'hidden',
            position: 'relative',
        } },
        React.createElement("img", { src: placeholder?.[0]?.uri, style: {
                width: '100%',
                height: '100%',
                position: 'absolute',
                left: 0,
                right: 0,
                objectFit: 'scale-down',
                objectPosition: 'center',
                ...placeholderStyle,
            } }),
        React.createElement("img", { src: selectedSource?.uri, style: {
                width: '100%',
                height: '100%',
                position: 'absolute',
                left: 0,
                right: 0,
                objectFit: contentFit,
                objectPosition: getObjectPositionFromContentPositionObject(contentPosition),
                ...imageStyle,
            }, onLoad: handlers.onLoad })));
}
//# sourceMappingURL=ExpoImage.web.js.map