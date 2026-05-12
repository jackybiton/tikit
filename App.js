import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const { height: screenHeight } = Dimensions.get("window");
const DEFAULT_SERVER_URL = "http://192.168.1.245:8765";
const FAVORITES_STORAGE_KEY = "favoriteVideos";
const SERVER_URL_STORAGE_KEY = "serverUrl";
const ADD_PASSWORD_STORAGE_KEY = "addPassword";

function cleanBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function compactError(error) {
  return error?.message || "Something went wrong";
}

function videoKey(video) {
  return `${video.username}:${video.id}`;
}

function FeedItem({ isActive, item, height, isFavorite, onDeleteVideo, onToggleFavorite }) {
  return (
    <View style={[styles.feedItem, { height }]}>
      <Video
        source={{ uri: item.videoUrl || item.url }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive}
        isLooping
        useNativeControls={false}
      />

      <View style={styles.videoMeta} pointerEvents="none">
        <Text style={styles.username}>@{item.username}</Text>
        {!!item.description && <Text style={styles.description} numberOfLines={4}>{item.description}</Text>}
      </View>

      <View style={styles.actionRail}>
        <Pressable
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          style={[styles.railButton, isFavorite && styles.favoriteButton]}
          onPress={() => onToggleFavorite(item)}
        >
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={30} color={isFavorite ? "#ff3b63" : "#ffffff"} />
        </Pressable>
        <Text style={styles.railLabel}>Favorite</Text>

        <Pressable
          accessibilityLabel="Delete video from server"
          style={[styles.railButton, styles.deleteButton]}
          onPress={() => onDeleteVideo(item)}
        >
          <Ionicons name="trash-outline" size={27} color="#ffffff" />
        </Pressable>
        <Text style={styles.railLabel}>Delete</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [addPassword, setAddPassword] = useState("");
  const [username, setUsername] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [feedMode, setFeedMode] = useState("all");
  const [favoriteVideos, setFavoriteVideos] = useState({});
  const [activeVideoKey, setActiveVideoKey] = useState(null);
  const listRef = useRef(null);

  const apiBase = useMemo(() => cleanBaseUrl(serverUrl), [serverUrl]);
  const itemHeight = settingsOpen ? Math.max(screenHeight - 310, 360) : screenHeight;
  const favoriteList = useMemo(() => Object.values(favoriteVideos), [favoriteVideos]);
  const visibleVideos = feedMode === "favorites" ? favoriteList : videos;

  const requestJson = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }, [apiBase]);

  const loadAccounts = useCallback(async () => {
    const data = await requestJson("/accounts");
    setAccounts(data.accounts || []);
  }, [requestJson]);

  const loadFeed = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
    }

    try {
      const data = await requestJson("/feed?limit=4");
      setVideos(data.videos || []);
      setActiveVideoKey((currentKey) => currentKey || (data.videos?.[0] ? videoKey(data.videos[0]) : null));

      if (data.errors?.length) {
        Alert.alert("Some accounts failed", data.errors.map((entry) => `@${entry.username}: ${entry.error}`).join("\n\n"));
      }
    } catch (error) {
      Alert.alert("Feed error", compactError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestJson]);

  useEffect(() => {
    loadAccounts().catch(() => {});
    loadFeed({ quiet: true }).catch(() => {});
  }, [loadAccounts, loadFeed]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setFavoriteVideos(JSON.parse(value));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SERVER_URL_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setServerUrl(value);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(ADD_PASSWORD_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setAddPassword(value);
        }
      })
      .catch(() => {});
  }, []);

  const addAccount = async () => {
    const nextUsername = username.trim();

    if (!nextUsername) {
      return;
    }

    try {
      const data = await requestJson("/accounts", {
        method: "POST",
        body: JSON.stringify({ username: nextUsername, password: addPassword })
      });

      setAccounts(data.accounts || []);
      setUsername("");
      await loadFeed({ quiet: true });
    } catch (error) {
      Alert.alert("Could not add account", compactError(error));
    }
  };

  const removeAccount = async (account) => {
    try {
      const data = await requestJson(`/accounts?username=${encodeURIComponent(account)}`, { method: "DELETE" });
      setAccounts(data.accounts || []);
      await loadFeed({ quiet: true });
    } catch (error) {
      Alert.alert("Could not remove account", compactError(error));
    }
  };

  const deleteVideo = async (video) => {
    Alert.alert(
      "Delete video",
      "Remove this video from the server and hide it from the feed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await requestJson(`/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" });
              setVideos((currentVideos) => currentVideos.filter((item) => item.id !== video.id));

              const nextFavorites = { ...favoriteVideos };
              delete nextFavorites[videoKey(video)];
              setFavoriteVideos(nextFavorites);
              await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
            } catch (error) {
              Alert.alert("Could not delete video", compactError(error));
            }
          }
        }
      ]
    );
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    await loadFeed({ quiet: true });
  };

  const toggleFavorite = async (video) => {
    const key = videoKey(video);
    const nextFavorites = { ...favoriteVideos };

    if (nextFavorites[key]) {
      delete nextFavorites[key];
    } else {
      nextFavorites[key] = video;
    }

    setFavoriteVideos(nextFavorites);

    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
    } catch (error) {
      Alert.alert("Favorites error", compactError(error));
    }
  };

  const setModeAndResetScroll = (mode) => {
    setFeedMode(mode);
    const firstVideo = mode === "favorites" ? favoriteList[0] : videos[0];
    setActiveVideoKey(firstVideo ? videoKey(firstVideo) : null);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visibleItem = viewableItems.find((entry) => entry.isViewable)?.item;

    if (visibleItem) {
      setActiveVideoKey(videoKey(visibleItem));
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const updateServerUrl = async (value) => {
    setServerUrl(value);

    try {
      await AsyncStorage.setItem(SERVER_URL_STORAGE_KEY, value);
    } catch {
    }
  };

  const updateAddPassword = async (value) => {
    setAddPassword(value);

    try {
      await AsyncStorage.setItem(ADD_PASSWORD_STORAGE_KEY, value);
    } catch {
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      {settingsOpen && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.settings}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.title}>User Feed</Text>
              <Text style={styles.subtitle}>
                {videos.length} videos from {accounts.length} accounts - {favoriteList.length} favorites
              </Text>
            </View>

            <Pressable style={styles.iconButton} onPress={() => loadFeed()}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="sync" size={21} color="#ffffff" />}
            </Pressable>
          </View>

          <TextInput
            value={serverUrl}
            onChangeText={updateServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="API server URL"
            placeholderTextColor="#8d96a8"
            style={styles.input}
          />

          <TextInput
            value={addPassword}
            onChangeText={updateAddPassword}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Password for adding users"
            placeholderTextColor="#8d96a8"
            secureTextEntry
            style={[styles.input, styles.passwordInput]}
          />

          <View style={styles.addRow}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@username or TikTok profile link"
              placeholderTextColor="#8d96a8"
              style={[styles.input, styles.accountInput]}
              onSubmitEditing={addAccount}
            />
            <Pressable style={styles.addButton} onPress={addAccount}>
              <Ionicons name="add" size={24} color="#05070d" />
            </Pressable>
          </View>

          <FlatList
            data={accounts}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountChips}
            renderItem={({ item }) => (
              <Pressable style={styles.chip} onLongPress={() => removeAccount(item)}>
                <Text style={styles.chipText}>@{item}</Text>
                <Ionicons name="close" size={15} color="#b9c0cf" />
              </Pressable>
            )}
          />

          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, feedMode === "all" && styles.modeTabActive]}
              onPress={() => setModeAndResetScroll("all")}
            >
              <Ionicons name="play-circle-outline" size={17} color={feedMode === "all" ? "#05070d" : "#d7ddec"} />
              <Text style={[styles.modeTabText, feedMode === "all" && styles.modeTabTextActive]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, feedMode === "favorites" && styles.modeTabActive]}
              onPress={() => setModeAndResetScroll("favorites")}
            >
              <Ionicons name="heart" size={17} color={feedMode === "favorites" ? "#05070d" : "#d7ddec"} />
              <Text style={[styles.modeTabText, feedMode === "favorites" && styles.modeTabTextActive]}>Favorites</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Pressable style={styles.settingsToggle} onPress={() => setSettingsOpen((value) => !value)}>
        <Ionicons name={settingsOpen ? "chevron-up" : "settings-outline"} size={22} color="#ffffff" />
      </Pressable>

      <FlatList
        ref={listRef}
        data={visibleVideos}
        keyExtractor={(item) => item.id + item.username}
        renderItem={({ item }) => (
          <FeedItem
            item={item}
            height={itemHeight}
            isActive={activeVideoKey === videoKey(item)}
            isFavorite={Boolean(favoriteVideos[videoKey(item)])}
            onDeleteVideo={deleteVideo}
            onToggleFavorite={toggleFavorite}
          />
        )}
        pagingEnabled
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFeed} tintColor="#ffffff" />}
        ListEmptyComponent={
          <View style={[styles.empty, { height: itemHeight }]}>
            {loading ? <ActivityIndicator color="#ffffff" /> : (
              <>
                <Ionicons name="videocam-outline" size={42} color="#ffffff" />
                <Text style={styles.emptyTitle}>
                  {feedMode === "favorites" ? "No favorites yet" : "No videos yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {feedMode === "favorites" ? "Tap the heart on videos you want to save." : "Add TikTok users and pull to refresh."}
                </Text>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05070d" },
  settings: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, backgroundColor: "#0b0f1a", borderBottomColor: "#222838", borderBottomWidth: 1 },
  topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  title: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#9da6b8", fontSize: 13, marginTop: 2 },
  iconButton: { alignItems: "center", backgroundColor: "#202637", borderRadius: 8, height: 42, justifyContent: "center", width: 42 },
  input: { backgroundColor: "#151b29", borderColor: "#2d3548", borderRadius: 8, borderWidth: 1, color: "#ffffff", fontSize: 14, height: 42, paddingHorizontal: 12 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  passwordInput: { marginTop: 8 },
  accountInput: { flex: 1 },
  addButton: { alignItems: "center", backgroundColor: "#ffffff", borderRadius: 8, height: 42, justifyContent: "center", width: 48 },
  accountChips: { gap: 8, paddingTop: 10 },
  chip: { alignItems: "center", backgroundColor: "#1b2231", borderColor: "#323a4e", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { color: "#eef2ff", fontSize: 13, fontWeight: "700" },
  modeTabs: { backgroundColor: "#151b29", borderColor: "#2d3548", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, marginTop: 10, padding: 4 },
  modeTab: { alignItems: "center", borderRadius: 6, flex: 1, flexDirection: "row", gap: 6, height: 36, justifyContent: "center" },
  modeTabActive: { backgroundColor: "#ffffff" },
  modeTabText: { color: "#d7ddec", fontSize: 13, fontWeight: "800" },
  modeTabTextActive: { color: "#05070d" },
  settingsToggle: { alignItems: "center", alignSelf: "center", backgroundColor: "#1f2636", borderRadius: 8, height: 36, justifyContent: "center", position: "absolute", right: 12, top: 12, width: 42, zIndex: 3 },
  feedItem: { backgroundColor: "#05070d" },
  video: { backgroundColor: "#05070d", flex: 1 },
  videoMeta: { bottom: 26, left: 16, position: "absolute", right: 72 },
  username: { color: "#ffffff", fontSize: 18, fontWeight: "800", marginBottom: 7, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 8 },
  description: { color: "#ffffff", fontSize: 14, lineHeight: 19, textShadowColor: "rgba(0,0,0,0.78)", textShadowRadius: 8 },
  actionRail: { alignItems: "center", bottom: 32, position: "absolute", right: 14 },
  railButton: { alignItems: "center", backgroundColor: "rgba(10, 12, 18, 0.58)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 8, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  favoriteButton: { backgroundColor: "rgba(255, 59, 99, 0.16)", borderColor: "rgba(255, 59, 99, 0.45)" },
  deleteButton: { backgroundColor: "rgba(255, 255, 255, 0.12)", marginTop: 14 },
  railLabel: { color: "#ffffff", fontSize: 11, fontWeight: "800", marginTop: 6, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 5 },
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 34 },
  emptyTitle: { color: "#ffffff", fontSize: 22, fontWeight: "800", marginTop: 12 },
  emptyText: { color: "#9da6b8", fontSize: 15, marginTop: 6, textAlign: "center" }
});
