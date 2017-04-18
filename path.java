	public static String getPackageDirPath(Context context) {
		if (context != null) {
			if (Build.VERSION.SDK_INT >= 19 && context.getExternalFilesDir(null) != null) {
				return context.getExternalFilesDir(null).getAbsolutePath();
			} else if (Build.VERSION.SDK_INT >= 17) {
				String externalStorageDirectory = Environment.getExternalStorageDirectory().getAbsolutePath();
				if (!TextUtils.isEmpty(externalStorageDirectory)) {
					String defaultPath = externalStorageDirectory.replace("emulated/", "sdcard");
					File file = new File(defaultPath);
					if (file.exists()) {
						return defaultPath + File.separator + "Android" + File.separator + "data" + File.separator + context.getPackageName()
								+ File.separator + "files";
					} else {
						return externalStorageDirectory + File.separator + "Android" + File.separator + "data" + File.separator + context
								.getPackageName() + File.separator + "files";
					}
				}
			} else {
				try {
					return Environment.getExternalStorageDirectory().getCanonicalPath() + File.separator + "Android" + File.separator + "data"
							+ File.separator + context.getPackageName() + File.separator + "files";
				} catch (IOException e) {
					KKDebug.e("getDefaultSDCardPath " + Log.getStackTraceString(e));
				}
			}
		}
		return null;
	}
