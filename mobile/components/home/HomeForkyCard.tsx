import { Image, Pressable, Text, View } from 'react-native';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { requestForkInRoadQuiz } from '../../lib/forkinator/forkInRoadQuizRequest';

const FORKY = require('../../assets/forkinator/forkinator-full.png');

/** Source art is 131 x 360; shown 52 wide so the face sits in the card and the handle runs off the bottom. */
const FORKY_WIDTH = 52;
const FORKY_HEIGHT = Math.round((FORKY_WIDTH * 360) / 131);

/** Green card on Home where Forky offers the three-question "pick dinner" quiz. */
export function HomeForkyCard() {
  return (
    <View
      className="mt-4 overflow-hidden rounded-[20px] bg-primary py-4 pr-4"
      style={{ paddingLeft: 84 }}
    >
      <Image
        source={FORKY}
        accessible={false}
        resizeMode="contain"
        style={{
          position: 'absolute',
          left: 16,
          top: 10,
          width: FORKY_WIDTH,
          height: FORKY_HEIGHT,
          transform: [{ rotate: '-6deg' }],
        }}
      />
      <Text className="text-base font-bold leading-5 text-on-primary">
        {RECIPES_COPY.homeForkyCard.body}
      </Text>
      <Pressable
        onPress={requestForkInRoadQuiz}
        accessibilityRole="button"
        accessibilityLabel={RECIPES_COPY.homeForkyCard.button}
        className="mt-3 min-h-[44px] items-center justify-center self-start rounded-full bg-cream px-5"
      >
        <Text className="text-[15px] font-bold text-primary">{RECIPES_COPY.homeForkyCard.button}</Text>
      </Pressable>
    </View>
  );
}
